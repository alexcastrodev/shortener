class PurgeOldNotificationsJob < ApplicationJob
  queue_as :default

  def perform
    Notification.where(created_at: ...Notification::RETENTION.ago).in_batches(of: 1000, &:delete_all)
  end
end
