class Api::Me::NotificationsController < ApplicationController
  before_action :authenticate_user!

  PAGE = 30

  def index
    scope = mine
    scope = scope.where(id: ...params[:before].to_i) if params[:before].present?
    rows = scope.order(id: :desc).limit(PAGE + 1).to_a
    more = rows.size > PAGE
    rows = rows.first(PAGE)
    render(json: { notifications: rows.map { |row| serialize(row) }, unread_count: mine.unread.count, next_before: more ? rows.last.id : nil }, status: :ok)
  end

  def read
    row = mine.find(params[:id])
    row.update!(read_at: Time.current) if row.read_at.nil?
    render(json: { notification: serialize(row), unread_count: mine.unread.count }, status: :ok)
  end

  def read_all
    mine.unread.update_all(read_at: Time.current)
    render(json: { unread_count: 0 }, status: :ok)
  end

  private

  def mine
    Notification.in_app.where(user_id: current_user.id, recipient_kind: ["owner", "client"])
  end

  def serialize(row)
    { id: row.id, kind: row.kind, recipient_kind: row.recipient_kind, payload: row.payload, read_at: row.read_at&.iso8601, created_at: row.created_at.iso8601 }
  end
end
