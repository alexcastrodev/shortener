module Appointments
  module RemindNow
    extend self

    COOLDOWN = 1.hour

    def call(row:, now: Time.current)
      group = row.group_key
      return :no_email if row.client_email.blank?

      rows = Appointment.where(group_key: group, status: "confirmed").joins(:slot).where("appointment_slots.starts_at > ?", now)
      return :nothing_to_remind unless rows.exists?

      earlier = Notification.where(kind: "appointment_reminder", channel: "email", appointment_id: Appointment.where(group_key: group).select(:id), created_at: (now - COOLDOWN)..)
      return :too_soon if earlier.exists?

      payload = { form_id: row.form_id, response_id: row.response_id, group_key: group, sessions: rows.count }
      queued = Notification.queue_email(kind: "appointment_reminder", event_key: "#{group}:m#{SecureRandom.hex(4)}", source: row, recipient_kind: "client", recipient_email: row.client_email, payload: payload)
      ActiveRecord.after_all_transactions_commit { NotificationDeliveryJob.perform_later(queued.id) }
      :ok
    end
  end
end
