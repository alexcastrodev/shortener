class Api::Me::UsersController < ApplicationController
  include SessionCookie

  RECENT_SIGN_IN = 15.minutes

  before_action :authenticate_user!

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
      render(json: { error: error }, status: :unprocessable_content)
    end
  end

  # POST /api/me/data_export  { current_password? }
  def export
    if @current_user.password?
      return render(json: { error: "invalid_current_password" }, status: :unprocessable_content) unless @current_user.authenticate_password(params[:current_password])
    elsif Time.zone.at(@session_payload["iat"].to_i) < RECENT_SIGN_IN.ago
      return render(json: { error: "reauthentication_required" }, status: :forbidden)
    end

    return render(json: { error: "export_weekly_limit" }, status: :too_many_requests) unless Rails.cache.write("data-export:#{@current_user.id}", true, expires_in: 1.week, unless_exist: true)

    SendDataExportJob.perform_later(@current_user.id)
    render(json: { queued: true }, status: :accepted)
  end

  # DELETE /api/me  { confirm_email, current_password? }
  def destroy
    unless params[:confirm_email].to_s.strip.downcase == @current_user.email
      return render(json: { error: "confirmation_mismatch" }, status: :unprocessable_content)
    end

    if @current_user.password?
      return render(json: { error: "invalid_current_password" }, status: :unprocessable_content) unless @current_user.authenticate_password(params[:current_password])
    elsif Time.zone.at(@session_payload["iat"].to_i) < RECENT_SIGN_IN.ago
      return render(json: { error: "reauthentication_required" }, status: :forbidden)
    end

    @current_user.request_deletion!
    AccountMailer.with(user: @current_user).deletion_scheduled.deliver_later
    clear_session_cookie
    render(json: { deletion_due_at: @current_user.deletion_due_at.iso8601 }, status: :accepted)
  end
end
