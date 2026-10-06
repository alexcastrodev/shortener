module Appointments
  module Impact
    extend self

    SAMPLE = 50

    def call(form:, now: Time.current)
      booking = form.fields.find { |field| field["type"] == "booking" }
      return { upcoming: 0, affected: 0, appointments: [] } unless booking

      zone = Time.find_zone!(booking.dig("rules", "time_zone") || "UTC")
      rows = Appointment.holding.joins(:slot).where(form_id: form.id).where("appointment_slots.starts_at > ?", now).includes(:slot).order("appointment_slots.starts_at", :id).to_a
      affected = rows.filter_map do |row|
        reason = reason_for(booking, zone, row.slot)
        { id: row.id, starts_at: row.slot.starts_at.utc.iso8601, reason: reason } if reason
      end
      { upcoming: rows.size, affected: affected.size, appointments: affected.first(SAMPLE) }
    end

    private

    def reason_for(booking, zone, slot)
      service = booking["services"].find { |item| item["id"] == slot.service_key }
      return "service_removed" unless service

      "time_no_longer_offered" unless Slots.offered?(service: service, exceptions: booking["exceptions"].to_a, zone: zone, starts_at: slot.starts_at)
    end
  end
end
