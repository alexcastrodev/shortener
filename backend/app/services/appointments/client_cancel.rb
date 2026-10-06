module Appointments
  # The client cancels from the link in the confirmation email: every session of
  # the booking that has not started yet. It is safe to repeat: sessions that
  # are already cancelled are left alone and nothing is notified twice.
  module ClientCancel
    extend self

    REASON_MAX = 500

    def call(appointment:, reason: nil, now: Time.current)
      group = appointment.group_key
      cancelled = []

      Appointment.transaction do
        rows = Appointment.where(group_key: group, status: Appointment::HOLDING).includes(:slot).order(:id).lock.select { |row| row.slot.starts_at > now }
        next if rows.empty?

        Appointment.where(id: rows.map(&:id)).update_all(status: "cancelled", cancelled_by: "client", cancel_reason: reason.to_s.strip.first(REASON_MAX).presence, decided_at: now)
        Release.call(rows.map(&:slot_id))
        cancelled = rows
        notify(rows.first, group, rows.size)
      end

      cancelled
    end

    private

    def notify(first, group, count)
      payload = { form_id: first.form_id, response_id: first.response_id, group_key: group, sessions: count }
      Notification.notify_owner(user_id: first.form.user_id, kind: "appointment_cancelled", event_key: group, source: first, payload: payload)
      queued = []
      if first.client_email.present?
        queued << Notification.queue_email(kind: "appointment_cancelled", event_key: group, source: first, recipient_kind: "client", recipient_email: first.client_email, payload: payload)
      end
      ids = queued.map(&:id)
      ActiveRecord.after_all_transactions_commit { ids.each { |id| NotificationDeliveryJob.perform_later(id) } }
    end
  end
end
