class NotificationDeliveryJob < ApplicationJob
  queue_as :notifications

  def perform(notification_id)
    Notifications::Deliver.call(id: notification_id)
  end
end
