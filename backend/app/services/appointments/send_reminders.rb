module Appointments
  module SendReminders
    extend self

    DEFAULT_LEADS = [1440].freeze
    HORIZON = Forms::BookingSchema::REMINDER_RANGE.max.minutes

    def call(now: Time.current)
      rows = Appointment.joins(:slot).includes(:slot, :form)
        .where(status: "confirmed")
        .where.not(client_email: [nil, ""])
        .where(appointment_slots: { starts_at: (now + 1.second)..(now + HORIZON) })
      rows.group_by(&:group_key).filter_map { |group, items| queue(group, items, now) }.size
    end

    def leads_for(form)
      booking = form.fields.find { |field| field["type"] == "booking" }
      booking&.dig("rules", "reminder_minutes") || DEFAULT_LEADS
    end

    private

    def queue(group, items, now)
      sorted = items.sort_by(&:id)
      starts = items.map { |row| row.slot.starts_at }.min
      booked = items.map(&:created_at).min
      sent = items.flat_map(&:reminders_sent).uniq
      due = leads_for(sorted.first.form).reject { |lead| sent.include?(lead) }.select { |lead| starts - lead.minutes <= now && booked <= starts - lead.minutes }
      return if due.empty?

      lead = due.min
      Appointment.transaction do
        scope = Appointment.where(group_key: group, status: "confirmed")
        scope.update_all(["reminders_sent = reminders_sent || ARRAY[?]::integer[], reminder_sent_at = ?", due, Time.current])
        first = sorted.first
        payload = { form_id: first.form_id, response_id: first.response_id, group_key: group, sessions: Appointment.where(group_key: group).count }
        Notification.queue_email(kind: "appointment_reminder", event_key: "#{group}:r#{lead}", source: first, recipient_kind: "client", recipient_email: first.client_email, payload: payload)
      end
    end
  end
end
