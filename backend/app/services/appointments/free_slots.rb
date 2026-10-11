module Appointments
  module FreeSlots
    extend self

    def call(form:, booking:, service:, from:, to:, now: Time.current, releasing: nil, only: nil)
      rules = booking["rules"]
      zone = Time.find_zone!(rules["time_zone"])
      stored = AppointmentSlot.where(form_id: form.id, starts_at: zone.local(from.year, from.month, from.day).utc..zone.local(to.year, to.month, to.day).end_of_day.utc)
      shared, own = stored.of_resource(Resource.key(service)).pluck(:starts_at, Arel.sql("booked + held"), :duration, :service_key).partition { |*, held_by| held_by != service["id"] }
      rows = own.map { |time, count, minutes, _| [time, count, minutes] }
      booked = rows.to_h { |time, count, _| [time.to_i, count] }
      lengths = rows.select { |_, count, _| count.positive? }.to_h { |time, _, minutes| [time.to_i, minutes || service["duration"]] }
      occupied = shared.select { |_, count, _, _| count.positive? }.map { |time, _, minutes, held_by| { starts_at: time, minutes: minutes || primary_minutes(booking, held_by) || service["duration"] } }
      booked[releasing.to_i] -= 1 if releasing && booked.key?(releasing.to_i)
      lengths.delete(releasing.to_i) if releasing && booked[releasing.to_i].to_i <= 0
      totals = stored.pluck(:starts_at, :booked).each_with_object(Hash.new(0)) { |(time, count), sums| sums[time.in_time_zone(zone).to_date] += count }

      Slots.call(service: service, rules: rules, from: from, to: to, now: now, booked: booked, day_totals: totals, exceptions: booking["exceptions"].to_a, lengths: lengths, occupied: occupied, only: only)
    end

    private

    def primary_minutes(booking, service_key) = booking["services"].find { |item| item["id"] == service_key }&.dig("duration")
  end
end
