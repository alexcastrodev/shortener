# Renders the outcome of a LoginCodeRequest the same way for every endpoint
# that emails a code (sign-in, sign-up, password reset).
module CodeRequestResponse
  extend ActiveSupport::Concern

  private

  def render_code_request(result)
    case result.status
    when :sent
      render(json: { message: "If the email can receive a code, it is on its way." })
    when :invalid_email
      render(json: { error: "invalid_email" }, status: :unprocessable_entity)
    when :undeliverable
      render(json: { error: "undeliverable_email" }, status: :unprocessable_entity)
    when :budget_exhausted
      render(json: { error: result.reason.to_s }, status: :service_unavailable)
    end
  end

  def turnstile_passed?(action)
    return true if Turnstile.valid?(params[:turnstile_token], action: action, remote_ip: client_ip)

    render(json: { error: "captcha_failed" }, status: :forbidden)
    false
  end

  def start_session(user)
    token = SessionToken.issue(user)
    set_session_cookie(token, SessionToken::TTL.from_now)
    # The token only travels in the httpOnly cookie, never in the body.
    render(json: CurrentUserSerializer.new(user).serialize, status: :ok)
  end
end
