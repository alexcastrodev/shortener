module Appointments
  module SendReminders
    extend self

    LEAD = 24.hours

    def call(now: Time.current)
      due(now).filter_map { |group| queue(group) }.size
    end

    private

    def due(now)
      Appointment.joins(:slot)
        .where(status: "confirmed", reminder_sent_at: nil)
        .where.not(client_email: [nil, ""])
        .group("appointments.group_key")
        .having("MIN(appointment_slots.starts_at) > ? AND MIN(appointment_slots.starts_at) <= ?", now, now + LEAD)
        .having("MIN(appointments.created_at) <= MIN(appointment_slots.starts_at) - interval '#{LEAD.to_i} seconds'")
        .pluck("appointments.group_key")
    end

    def queue(group)
      Appointment.transaction do
        rows = Appointment.where(group_key: group, status: "confirmed", reminder_sent_at: nil)
        first = rows.order(:id).first
        next unless first && rows.update_all(reminder_sent_at: Time.current).positive?

        payload = { form_id: first.form_id, response_id: first.response_id, group_key: group, sessions: Appointment.where(group_key: group).count }
        Notification.queue_email(kind: "appointment_reminder", event_key: group, source: first, recipient_kind: "client", recipient_email: first.client_email, payload: payload)
      end
    end
  end
end
