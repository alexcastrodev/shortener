# Setting or changing the password of the signed-in account. Changing it needs
# the current one; setting a first password (accounts that only used emailed
# codes) needs a sign-in from the last few minutes, so a session left open on
# someone else's computer cannot be turned into a permanent password.
class Api::Me::PasswordsController < ApplicationController
  include SessionCookie

  RECENT_SIGN_IN = 15.minutes

  before_action :authenticate_user!

  rate_limit to: 10,
    within: 15.minutes,
    only: :update,
    name: "me_password",
    by: -> { current_user&.id },
    with: -> { render(json: { error: "Too many attempts, please try again later" }, status: :too_many_requests) }

  # PUT /api/me/password  { current_password, password }
  def update
    if @current_user.password?
      unless @current_user.authenticate_password(params[:current_password])
        return render(json: { error: "invalid_current_password" }, status: :unprocessable_entity)
      end
    elsif Time.zone.at(@session_payload["iat"].to_i) < RECENT_SIGN_IN.ago
      return render(json: { error: "reauthentication_required" }, status: :forbidden)
    end

    error = PasswordPolicy.error_for(params[:password], email: @current_user.email)
    return render(json: { error: error }, status: :unprocessable_entity) if error

    @current_user.change_password!(params[:password])
    # Every other session ends; this one continues with a fresh token.
    set_session_cookie(SessionToken.issue(@current_user), SessionToken::TTL.from_now)
    render(json: CurrentUserSerializer.new(@current_user).serialize, status: :ok)
  end
end
