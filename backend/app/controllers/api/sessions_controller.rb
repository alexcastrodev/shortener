class Api::SessionsController < ApplicationController
  include SessionCookie
  include ClientIp
  include CodeRequestResponse

  # Per IP: one visitor cycling through fresh addresses hits these long before
  # the shared email budget (MailBudget), so they cannot spend it for others.
  rate_limit to: 10,
    within: 10.minutes,
    only: :create,
    name: "login_request_ip",
    by: -> { client_ip },
    with: -> { too_many_requests }
  rate_limit to: 30,
    within: 1.day,
    only: :create,
    name: "login_request_ip_daily",
    by: -> { client_ip },
    with: -> { too_many_requests }
  # Password guessing: per IP across accounts, per account across IPs (the
  # account itself also locks for a while, see PasswordAuthenticatable).
  rate_limit to: 20,
    within: 10.minutes,
    only: :password,
    name: "login_password_ip",
    by: -> { client_ip },
    with: -> { too_many_requests }
  rate_limit to: 10,
    within: 15.minutes,
    only: :password,
    name: "login_password_email",
    by: -> { normalized_email },
    with: -> { too_many_requests }
  rate_limit to: 20,
    within: 10.minutes,
    only: :google,
    name: "login_google_ip",
    by: -> { client_ip },
    with: -> { too_many_requests }
  # Per email: guessing a code, or flooding one inbox.
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

  # POST /api/login_request  { email, turnstile_token }
  def create
    return render(json: { error: "Email is required" }, status: :unprocessable_entity) if params[:email].blank?
    return unless turnstile_passed?("login")

    render_code_request(LoginCodeRequest.call(email: params[:email], purpose: :sign_in))
  end

  # POST /api/login/password  { email, password, turnstile_token }
  # One answer for every failure (unknown email, unconfirmed account, wrong
  # or locked password), and the same work behind each, so neither the
  # message nor the timing tells whether an account exists.
  def password
    return unless turnstile_passed?("login")

    user = User.find_by(email: normalized_email)
    usable = user&.verified? && user.active?
    authenticated = usable ? user.authenticate_password(params[:password]) : User.burn_password_check(params[:password])

    return render(json: { error: "invalid_credentials" }, status: :unauthorized) unless authenticated

    user.clear_login_token! if user.login_token.present?
    start_session(user)
  end

  # POST /api/login/google  { credential }
  # The ID token from Google Identity Services (see GoogleSignIn).
  def google
    result = GoogleSignIn.call(credential: params[:credential])

    case result.error
    when nil then start_session(result.user)
    when :deactivated then render(json: { error: I18n.t("errors.account_deactivated") }, status: :forbidden)
    when :disabled then head(:not_found)
    else render(json: { error: "google_#{result.error}" }, status: :unauthorized)
    end
  end

  # POST /api/login_verify  { email, code, purpose }
  # purpose "sign_up" confirms a new account and turns on the password chosen
  # when signing up; any other code sign-in drops that pending password (see
  # PasswordAuthenticatable#activate_pending_password!).
  def verify
    user = User.find_by(email: normalized_email)

    if user && (dev_bypass? || user.verify_login_token(params[:code]))
      if user.deactivated?
        render(json: { error: I18n.t("errors.account_deactivated") }, status: :forbidden)
        return
      end

      user.clear_login_token!
      params[:purpose] == "sign_up" ? user.activate_pending_password! : user.discard_pending_password!
      user.mark_verified!
      start_session(user)
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
