module Appointments
  module Decide
    extend self

    DECISIONS = ["approve", "decline"].freeze
    MESSAGE_MAX = 500

    def call(appointment:, decision:, message: nil, now: Time.current)
      return :invalid unless DECISIONS.include?(decision)

      outcome = nil
      Appointment.transaction do
        rows = Appointment.where(group_key: appointment.group_key, status: "pending").order(:id).lock.to_a
        outcome = outcome_for(rows, decision, now)
        next unless outcome.in?([:approve, :decline])

        text = message.to_s.strip.first(MESSAGE_MAX).presence
        approve = outcome == :approve
        Appointment.where(id: rows.map(&:id)).update_all(status: approve ? "confirmed" : "declined", decided_by: "owner", decided_at: now, decision_message: text)
        Release.call(rows.map(&:slot_id)) unless approve
        notify_client(rows.first, approve)
      end
      outcome
    end

    private

    def outcome_for(rows, decision, now)
      return :already_decided if rows.empty?
      return :expired if rows.first.expires_at <= now

      decision.to_sym
    end

    def notify_client(first, approve)
      return if first.client_email.blank?

      payload = { form_id: first.form_id, response_id: first.response_id, group_key: first.group_key }
      queued = Notification.queue_email(kind: approve ? "appointment_confirmed" : "appointment_declined", event_key: first.group_key, source: first, recipient_kind: "client", recipient_email: first.client_email, payload: payload)
      ActiveRecord.after_all_transactions_commit { NotificationDeliveryJob.perform_later(queued.id) }
    end
  end
end
