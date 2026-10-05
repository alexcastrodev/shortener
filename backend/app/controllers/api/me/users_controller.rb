class Api::Me::UsersController < ApplicationController
  include SessionCookie

  RECENT_SIGN_IN = 15.minutes

  before_action :authenticate_user!

  rate_limit to: 3,
    within: 1.hour,
    only: :export,
    name: "me_data_export",
    by: -> { current_user&.id },
    with: -> { render(json: { error: "Too many attempts, please try again later" }, status: :too_many_requests) }

  rate_limit to: 5,
    within: 1.hour,
    only: :destroy,
    name: "me_delete_account",
    by: -> { current_user&.id },
    with: -> { render(json: { error: "Too many attempts, please try again later" }, status: :too_many_requests) }

  def show
    render(json: CurrentUserSerializer.new(current_user).serialize, status: :ok)
  end

  def update
    if current_user.update(params.permit(:time_zone, :locale))
      render(json: CurrentUserSerializer.new(current_user).serialize, status: :ok)
    else
      error = current_user.errors.include?(:locale) ? "invalid_locale" : "invalid_time_zone"
      render(json: { error: error }, status: :unprocessable_entity)
    end
  end

  # POST /api/me/data_export  { current_password? }
  def export
    if @current_user.password?
      return render(json: { error: "invalid_current_password" }, status: :unprocessable_entity) unless @current_user.authenticate_password(params[:current_password])
    elsif Time.zone.at(@session_payload["iat"].to_i) < RECENT_SIGN_IN.ago
      return render(json: { error: "reauthentication_required" }, status: :forbidden)
    end

    response.headers["Cache-Control"] = "private, no-store"
    send_data(JSON.pretty_generate(Users::DataExport.call(user: @current_user)), type: "application/json", disposition: "attachment", filename: "kurz-data-#{Date.current.iso8601}.json")
  rescue Users::DataExport::TooLarge
    render(json: { error: "export_too_large", message: "There is too much data to export in one file. Export the forms with the most responses to Excel first, or contact the owner of the service." }, status: :payload_too_large)
  end

  # DELETE /api/me  { confirm_email, current_password? }
  def destroy
    unless params[:confirm_email].to_s.strip.downcase == @current_user.email
      return render(json: { error: "confirmation_mismatch" }, status: :unprocessable_entity)
    end

    if @current_user.password?
      return render(json: { error: "invalid_current_password" }, status: :unprocessable_entity) unless @current_user.authenticate_password(params[:current_password])
    elsif Time.zone.at(@session_payload["iat"].to_i) < RECENT_SIGN_IN.ago
      return render(json: { error: "reauthentication_required" }, status: :forbidden)
    end

    @current_user.request_deletion!
    AccountMailer.with(user: @current_user).deletion_scheduled.deliver_later
    clear_session_cookie
    render(json: { deletion_due_at: @current_user.deletion_due_at.iso8601 }, status: :accepted)
  end
end
