class Api::Me::NotificationsController < ApplicationController
  before_action :authenticate_user!

  PAGE = 30

  def index
    scope = mine
    scope = scope.where(id: ...params[:before].to_i) if params[:before].present?
    rows = scope.order(id: :desc).limit(PAGE + 1).to_a
    more = rows.size > PAGE
    rows = rows.first(PAGE)
    render(json: { notifications: Notification.present(rows, current_user), unread_count: mine.unread.count, next_before: more ? rows.last.id : nil }, status: :ok)
  end

  def read
    row = mine.find(params[:id])
    row.update!(read_at: Time.current) if row.read_at.nil?
    render(json: { notification: Notification.present([row], current_user).first, unread_count: mine.unread.count }, status: :ok)
  end

  def read_all
    mine.unread.update_all(read_at: Time.current)
    render(json: { unread_count: 0 }, status: :ok)
  end

  private

  def mine
    Notification.bell(current_user)
  end
end
