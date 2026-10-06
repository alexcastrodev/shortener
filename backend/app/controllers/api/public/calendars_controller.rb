class Api::Public::CalendarsController < ApplicationController
  include ClientIp

  rate_limit to: 60,
    within: 1.minute,
    name: "public_calendar",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  def show
    feed = CalendarFeed.resolve(params[:token])
    user = feed&.user
    raise ActiveRecord::RecordNotFound unless user&.deactivated_at.nil? && Appointments::Config.enabled_for?(user)

    feed.update_column(:last_fetched_at, Time.current)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    send_data(Appointments::Ics.call(user: user), type: "text/calendar; charset=utf-8", disposition: "inline", filename: "kurz.ics")
  end
end
