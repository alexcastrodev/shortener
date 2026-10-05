module Appointments
  module FreeSlots
    extend self

    def call(form:, booking:, service:, from:, to:, now: Time.current)
      rules = booking["rules"]
      zone = Time.find_zone!(rules["time_zone"])
      stored = AppointmentSlot.where(form_id: form.id, starts_at: zone.local(from.year, from.month, from.day).utc..zone.local(to.year, to.month, to.day).end_of_day.utc)
      booked = stored.where(service_key: service["id"]).pluck(:starts_at, :booked).to_h { |time, count| [time.to_i, count] }
      totals = stored.pluck(:starts_at, :booked).each_with_object(Hash.new(0)) { |(time, count), sums| sums[time.in_time_zone(zone).to_date] += count }

      Slots.call(service: service, rules: rules, from: from, to: to, now: now, booked: booked, day_totals: totals)
    end
  end
end
