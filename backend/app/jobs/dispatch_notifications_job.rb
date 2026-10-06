class DispatchNotificationsJob < ApplicationJob
  queue_as :notifications

  BATCH = 200

  def perform
    due = Notification.where(status: "pending").where(next_attempt_at: ..Time.current).order(:id).limit(BATCH).pluck(:id, :channel)
    due.each { |id, channel| (channel == "push" ? PushDeliveryJob : NotificationDeliveryJob).perform_later(id) if ["email", "push"].include?(channel) }
  end
end
