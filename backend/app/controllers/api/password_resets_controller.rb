# Forgotten password: a code goes to the address, and the code plus a new
# password sign the person in. Every other session is signed out.
class Api::PasswordResetsController < ApplicationController
  include SessionCookie
  include ClientIp
  include CodeRequestResponse

  rate_limit to: 10,
    within: 1.hour,
    only: :create,
    name: "password_forgot_ip",
    by: -> { client_ip },
    with: -> { too_many_requests }
  rate_limit to: 10,
    within: 15.minutes,
    only: :update,
    name: "password_reset_email",
    by: -> { params[:email].to_s.strip.downcase },
    with: -> { too_many_requests }

  # POST /api/password/forgot  { email, turnstile_token }
  def create
    return unless turnstile_passed?("password_reset")

    render_code_request(LoginCodeRequest.call(email: params[:email], purpose: :password_reset))
  end

  # POST /api/password/reset  { email, code, password }
  def update
    user = User.find_by(email: params[:email].to_s.strip.downcase)
    unless user&.verified? && user.active? && user.verify_login_token(params[:code])
      return render(json: { error: "invalid_code" }, status: :unauthorized)
    end

    error = PasswordPolicy.error_for(params[:password], email: user.email)
    return render(json: { error: error }, status: :unprocessable_entity) if error

    user.clear_login_token!
    user.change_password!(params[:password])
    start_session(user)
  end

  private

  def too_many_requests
    render(json: { error: "Too many attempts, please try again later" }, status: :too_many_requests)
  end
end
