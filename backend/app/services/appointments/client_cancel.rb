module Appointments
  # The client cancels from the link (or, with by: "owner", the owner cancels from the agenda; then only the client is told) in the confirmation email: every session of
  # the booking that has not started yet. It is safe to repeat: sessions that
  # are already cancelled are left alone and nothing is notified twice.
  module ClientCancel
    extend self

    REASON_MAX = 500

    SCOPES = ["all", "one", "remaining"].freeze

    def call(appointment:, reason: nil, now: Time.current, by: "client", scope: "all")
      group = appointment.group_key
      cancelled = []

      Appointment.transaction do
        rows = Appointment.where(group_key: group, status: Appointment::HOLDING).includes(:slot).order(:id).lock.select { |row| row.slot.starts_at > now }
        rows = within(rows, appointment, scope)
        next if rows.empty?

        Appointment.where(id: rows.map(&:id)).update_all(status: "cancelled", cancelled_by: by, cancel_reason: reason.to_s.strip.first(REASON_MAX).presence, decided_at: now)
        Release.call(rows.map(&:slot_id))
        cancelled = rows
        notify(rows, scope == "all" ? group : "#{group}:#{scope}#{rows.first.id}", by)
      end

      cancelled
    end

    private

    def within(rows, target, scope)
      case scope
      when "one" then rows.select { |row| row.id == target.id }
      when "remaining" then rows.select { |row| row.slot.starts_at >= target.slot.starts_at }
      else rows
      end
    end

    def notify(rows, key, by)
      first = rows.first
      payload = { form_id: first.form_id, response_id: first.response_id, group_key: first.group_key, sessions: rows.size, cancelled_ids: rows.map(&:id) }
      Notification.notify_owner(user_id: first.form.user_id, kind: "appointment_cancelled", event_key: key, source: first, payload: payload) if by == "client"
      queued = []
      queued << Notification.queue_email(kind: "appointment_cancelled", event_key: key, source: first, recipient_kind: "owner", user_id: first.form.user_id, payload: payload) if by == "client"
      if first.client_email.present?
        queued << Notification.queue_email(kind: "appointment_cancelled", event_key: key, source: first, recipient_kind: "client", recipient_email: first.client_email, payload: payload)
      end
      ids = queued.compact.map(&:id)
      ActiveRecord.after_all_transactions_commit { ids.each { |id| NotificationDeliveryJob.perform_later(id) } }
    end
  end
end
