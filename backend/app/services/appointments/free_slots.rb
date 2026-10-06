module Appointments
  module FreeSlots
    extend self

    def call(form:, booking:, service:, from:, to:, now: Time.current, releasing: nil)
      rules = booking["rules"]
      zone = Time.find_zone!(rules["time_zone"])
      stored = AppointmentSlot.where(form_id: form.id, starts_at: zone.local(from.year, from.month, from.day).utc..zone.local(to.year, to.month, to.day).end_of_day.utc)
      booked = stored.where(service_key: service["id"]).pluck(:starts_at, Arel.sql("booked + held")).to_h { |time, count| [time.to_i, count] }
      booked[releasing.to_i] -= 1 if releasing && booked.key?(releasing.to_i)
      totals = stored.pluck(:starts_at, :booked).each_with_object(Hash.new(0)) { |(time, count), sums| sums[time.in_time_zone(zone).to_date] += count }

      Slots.call(service: service, rules: rules, from: from, to: to, now: now, booked: booked, day_totals: totals, exceptions: booking["exceptions"].to_a)
    end
  end
end
