class PushDeliveryJob < ApplicationJob
  queue_as :notifications

  def perform(notification_id)
    Notifications::DeliverPush.call(id: notification_id)
  end
end
