class Api::SessionsController < ApplicationController
  include SessionCookie

  # Keyed by email rather than IP: the API sits behind a proxy, and the threats
  # are per account (guessing a code, flooding an inbox).
  rate_limit to: 5,
    within: 10.minutes,
    only: :create,
    name: "login_request",
    by: -> { normalized_email },
    with: -> { too_many_requests }
  rate_limit to: 10,
    within: 15.minutes,
    only: :verify,
    name: "login_verify",
    by: -> { normalized_email },
    with: -> { too_many_requests }

  # POST /api/login_request
  def create
    if params[:email].present?
      user = User.find_or_create_by(email: params[:email])
      user.send_magic_link

      render(json: { message: "If the email exists, the link has been sent." })
    else
      render(json: { error: "Email is required" }, status: :unprocessable_entity)
    end
  end

  # POST /api/login_verify
  def verify
    user = User.find_by(email: normalized_email)

    if user && (dev_bypass? || user.verify_login_token(params[:code]))
      if user.deactivated?
        render(json: { error: I18n.t("errors.account_deactivated") }, status: :forbidden)
        return
      end

      token = SessionToken.issue(user)
      user.clear_login_token!
      set_session_cookie(token, SessionToken::TTL.from_now)

      # The token only travels in the httpOnly cookie, never in the body.
      render(json: UserSerializer.new(user).serialize, status: :ok)
    else
      render(json: { error: "Token invalid or expired" }, status: :unauthorized)
    end
  end

  # DELETE /api/logout
  # Revokes the current token (not just the cookie), so a copy of it stops
  # working too. Always succeeds, even without a valid session.
  def destroy
    revoke_current_token
    clear_session_cookie
    head(:no_content)
  end

  private

  def revoke_current_token
    token = session_token
    SessionToken.revoke(SessionToken.decode(token)) if token.present?
  rescue JWT::DecodeError
    # Already invalid, expired or revoked: nothing to revoke.
  end

  def normalized_email
    params[:email].to_s.strip.downcase
  end

  def too_many_requests
    render(json: { error: "Too many attempts, please try again later" }, status: :too_many_requests)
  end

  # Development-only bypass: accept the fixed code "0000000" so the magic-link
  # flow can be exercised locally without a real email round-trip.
  def dev_bypass?
    Rails.env.development? && params[:code] == "0000000"
  end
end
