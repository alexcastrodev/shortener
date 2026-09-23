# Sign-up with email and password. The account only exists for real once the
# emailed code is confirmed (POST /api/login_verify with purpose "sign_up"),
# and the password only takes effect then.
class Api::RegistrationsController < ApplicationController
  include SessionCookie
  include ClientIp
  include CodeRequestResponse

  rate_limit to: 10,
    within: 1.hour,
    only: :create,
    name: "signup_ip",
    by: -> { client_ip },
    with: -> { render(json: { error: "Too many attempts, please try again later" }, status: :too_many_requests) }

  # POST /api/signup  { email, password, turnstile_token }
  def create
    return unless turnstile_passed?("signup")

    error = PasswordPolicy.error_for(params[:password], email: params[:email])
    return render(json: { error: error }, status: :unprocessable_entity) if error

    render_code_request(LoginCodeRequest.call(email: params[:email], purpose: :sign_up, password: params[:password]))
  end
end
