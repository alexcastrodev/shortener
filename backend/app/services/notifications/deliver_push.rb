module Notifications
  class DeliverPush
    include Callable

    LEASE = 10.minutes
    RETRY_IN = 5.minutes
    GIVE_UP_AFTER = 6.hours
    TTL = 1.hour.to_i
    TRANSIENT = [Socket::ResolutionError, Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED, Errno::ECONNRESET, WebPush::PushServiceError, WebPush::TooManyRequests].freeze

    def initialize(id:)
      @id = id
    end

    def call
      return unless claim

      notification = Notification.find(id)
      return finish(notification, "failed", "push_disabled") unless Push::Config.enabled?

      delivered = 0
      failures = []
      PushSubscription.where(user_id: notification.user_id).order(:id).each do |subscription|
        outcome = send_to(subscription, notification)
        delivered += 1 if outcome == :sent
        failures << outcome if outcome.is_a?(String)
      end

      return finish(notification, "sent") if delivered.positive?
      return finish(notification, "sent", "no_subscriptions") if failures.empty?
      return retry_later(notification, failures.first) if failures.all? { |reason| reason.start_with?("transient:") }

      finish(notification, "failed", failures.first)
    rescue StandardError => e
      Sentry.capture_exception(e, extra: { notification_id: id })
      finish(notification, "failed", e.class.name) if notification
    end

    private

    attr_reader :id

    def claim
      now = Time.current
      Notification.where(id: id, channel: "push", status: "pending", next_attempt_at: ..now).update_all(next_attempt_at: now + LEASE).positive?
    end

    def send_to(subscription, notification)
      return drop(subscription) unless subscription.valid?

      WebPush.payload_send(
        message: JSON.generate(kind: notification.kind, id: notification.id),
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        vapid: Push::Config.vapid,
        ttl: TTL,
        urgency: "normal",
      )
      subscription.update_columns(last_used_at: Time.current)
      :sent
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
      drop(subscription)
    rescue *TRANSIENT => e
      "transient:#{e.class.name}"
    rescue WebPush::Error => e
      e.class.name
    end

    def drop(subscription)
      subscription.destroy
      :dropped
    end

    def finish(notification, status, error = nil)
      notification.update!(status: status, sent_at: (Time.current if status == "sent"), attempts: notification.attempts + 1, last_error: error, next_attempt_at: nil)
    end

    def retry_later(notification, reason)
      return finish(notification, "failed", reason) if notification.created_at < GIVE_UP_AFTER.ago

      notification.update!(attempts: notification.attempts + 1, last_error: reason, next_attempt_at: Time.current + RETRY_IN)
    end
  end
end
