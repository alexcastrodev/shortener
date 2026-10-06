class Api::Me::CalendarFeedsController < ApplicationController
  before_action :authenticate_user!

  def show
    feed = current_user.calendar_feed
    render(json: { enabled: feed.present?, created_at: feed&.created_at, last_fetched_at: feed&.last_fetched_at }, status: :ok)
  end

  def create
    raw = CalendarFeed.issue(current_user)
    render(json: { enabled: true, url: "#{request.base_url}/api/public/calendar/#{raw}" }, status: :created)
  end

  def destroy
    current_user.calendar_feed&.destroy
    head(:no_content)
  end
end
