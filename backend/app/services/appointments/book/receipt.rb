module Appointments
  module Book
    module Receipt
      extend self

      def summary(response)
        response.appointments.includes(:slot).order("appointment_slots.starts_at").references(:slot).map do |appointment|
          {
            starts_at: appointment.slot.starts_at.iso8601,
            service: appointment.snapshot["name"],
            status: appointment.status,
            duration: appointment.snapshot["duration"],
          }
        end
      end

      def receipt(response, now: Time.current)
        rows = response.appointments.includes(:slot).to_a
        return if rows.empty?

        first = rows.min_by(&:id)
        last = rows.map { |row| row.slot.starts_at }.max
        receipt = {
          manage_url: manage_url(first, last, now: now),
          email_delivery: first.client_email.present? ? "queued" : "none",
        }
        receipt[:skipped] = rows.flat_map { |row| row.snapshot.dig("monthly", "skipped").to_a }.uniq.sort if rows.any? { |row| row.snapshot["monthly"] }
        receipt[:price] = { total: first.snapshot["total"], currency: rows.filter_map { |row| row.snapshot["currency"] }.first } if first.snapshot["total"]
        receipt
      end

      def manage_url(first, last, now: Time.current)
        raw = AppointmentToken.issue(booking: first, expires_at: [last, now].max + 7.days)
        "#{ENV.fetch("FRONTEND_URL", "https://kurz.fyi")}/m/#{raw}"
      end
    end
  end
end
