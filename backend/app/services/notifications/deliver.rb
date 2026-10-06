module Notifications
  class Deliver
    include Callable

    BUDGET_SHARE = 0.8
    LEASE = 10.minutes
    RETRY_IN = 5.minutes
    GIVE_UP_AFTER = 24.hours
    TRANSIENT = [Socket::ResolutionError, Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNREFUSED, Errno::ECONNRESET, Net::SMTPServerBusy].freeze
    TEMPLATES = { ["appointment_confirmed", "client"] => :confirmed, ["appointment_created", "owner"] => :new_booking, ["appointment_cancelled", "client"] => :cancelled }.freeze

    def initialize(id:)
      @id = id
    end

    def call
      return unless claim

      notification = Notification.find(id)
      template = TEMPLATES[[notification.kind, notification.recipient_kind]]
      return finish(notification, "failed", "unsupported") unless template && notification.appointment

      budget = MailBudget.reserve(new_address: false, share: BUDGET_SHARE)
      return retry_later(notification, "budget:#{budget.reason}") unless budget.ok?

      AppointmentMailer.with(notification: notification).public_send(template).deliver_now
      finish(notification, "sent")
    rescue *TRANSIENT => e
      retry_later(notification, e.class.name)
    rescue StandardError => e
      Sentry.capture_exception(e, extra: { notification_id: id })
      finish(notification, "failed", e.class.name) if notification
    end

    private

    attr_reader :id

    # Atomic: only one worker gets the row, and a crash leaves it to be
    # picked up again when the lease runs out.
    def claim
      now = Time.current
      Notification.where(id: id, channel: "email", status: "pending", next_attempt_at: ..now).update_all(next_attempt_at: now + LEASE).positive?
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
