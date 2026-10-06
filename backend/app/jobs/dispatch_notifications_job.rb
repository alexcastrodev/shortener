class DispatchNotificationsJob < ApplicationJob
  queue_as :notifications

  BATCH = 200

  def perform
    Notification.where(channel: "email", status: "pending")
      .where(next_attempt_at: ..Time.current)
      .order(:id).limit(BATCH).pluck(:id)
      .each { |id| NotificationDeliveryJob.perform_later(id) }
  end
end
