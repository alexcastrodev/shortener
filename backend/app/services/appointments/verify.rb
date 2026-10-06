module Appointments
  module Verify
    extend self

    def call(appointment:, now: Time.current)
      outcome = nil
      Appointment.transaction do
        rows = Appointment.where(group_key: appointment.group_key, status: "unverified").order(:id).lock.to_a
        outcome = outcome_for(rows, now)
        next unless outcome == :verified

        Appointment.where(id: rows.map(&:id)).update_all(status: "confirmed", expires_at: nil, decided_by: "client", decided_at: now)
        first = rows.first
        payload = { form_id: first.form_id, response_id: first.response_id, group_key: first.group_key, sessions: rows.size }
        Book.announce(form: first.form, first: first, group: first.group_key, email: first.client_email, payload: payload)
      end
      outcome
    end

    private

    def outcome_for(rows, now)
      return :already_done if rows.empty?
      return :expired if rows.first.expires_at <= now

      :verified
    end
  end
end
