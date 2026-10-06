module Appointments
  module ResolveExpired
    extend self

    def call(now: Time.current)
      groups = Appointment.where(status: "pending").where(expires_at: ..now).distinct.pluck(:group_key)
      groups.count { |group| decline(group, now) }
    end

    def lag(now: Time.current)
      oldest = Appointment.where(status: "pending").where(expires_at: ..now).minimum(:expires_at)
      oldest ? (now - oldest).to_i : 0
    end

    private

    def decline(group, now)
      Appointment.transaction do
        rows = Appointment.where(group_key: group, status: "pending").where(expires_at: ..now).includes(:slot).order(:id).lock.to_a
        next false if rows.empty?

        accept = rows.first.snapshot["on_timeout"] == "accept" && rows.all? { |row| row.slot.starts_at > now }
        Appointment.where(id: rows.map(&:id)).update_all(status: accept ? "confirmed" : "declined", decided_by: "timeout", decided_at: now)
        Release.call(rows.map(&:slot_id)) unless accept
        notify(rows.first, group, accept)
        true
      end
    end

    def notify(first, group, accept)
      payload = { form_id: first.form_id, response_id: first.response_id, group_key: group }
      Notification.notify_owner(user_id: first.form.user_id, kind: accept ? "appointment_auto_confirmed" : "appointment_expired", event_key: group, source: first, payload: payload)
      return if first.client_email.blank?

      queued = Notification.queue_email(kind: accept ? "appointment_confirmed" : "appointment_declined", event_key: group, source: first, recipient_kind: "client", recipient_email: first.client_email, payload: payload)
      ActiveRecord.after_all_transactions_commit { NotificationDeliveryJob.perform_later(queued.id) }
    end
  end
end
