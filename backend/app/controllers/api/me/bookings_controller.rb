class Api::Me::BookingsController < ApplicationController
  before_action :authenticate_user!
  before_action :require_verified

  rate_limit to: 20,
    within: 1.minute,
    only: :manage_link,
    name: "my_booking_manage_link",
    by: -> { current_user&.id },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  def index
    return render(json: { bookings: Appointments::ForClient.list(current_user) }, status: :ok) if params[:from].blank? && params[:to].blank?

    from = Date.iso8601(params[:from].to_s)
    to = Date.iso8601(params[:to].to_s)
    return invalid_range if to < from || (to - from) >= Appointments::Agenda::MAX_RANGE_DAYS

    render(json: { bookings: Appointments::ForClient.list(current_user, from: from, to: to) }, status: :ok)
  rescue Date::Error
    invalid_range
  end

  def manage_link
    url = Appointments::ForClient.manage_url(current_user, params[:group_key])
    return render(json: { error: "not_found" }, status: :not_found) unless url

    render(json: { manage_url: url }, status: :ok)
  end

  private

  def invalid_range
    render(json: { error: "invalid_range" }, status: :unprocessable_content)
  end

  def require_verified
    render(json: { error: "email_not_verified" }, status: :forbidden) unless current_user.verified?
  end
end
