module Appointments
  module Slots
    extend self

    MAX_RANGE_DAYS = 62
    WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].freeze

    def call(service:, rules:, from:, to:, now: Time.current, booked: {}, day_totals: {}, exceptions: [])
      zone = Time.find_zone!(rules.fetch("time_zone"))
      notice = rules.fetch("min_notice_minutes", 0).minutes
      last = [to, now.in_time_zone(zone).to_date + rules.fetch("window_days", 60), from + (MAX_RANGE_DAYS - 1)].min
      return [] if last < from

      (from..last).flat_map do |date|
        day_slots(service, rules, { zone: zone, date: date, earliest: now + notice, booked: booked, totals: day_totals, exceptions: exceptions })
      end
    end

    private

    def day_slots(service, rules, context)
      zone, date, earliest, booked, day_totals = context.values_at(:zone, :date, :earliest, :booked, :totals)
      return [] unless service["days"].include?(WEEKDAYS[date.wday])

      times = times_for(service, date, context[:exceptions])
      return [] unless times
      return [] if rules["max_per_day"] && day_totals.fetch(date, 0) >= rules["max_per_day"]

      capacity = service["capacity"]
      all = times.sort.filter_map { |time| build(zone, date, time, capacity, booked) }
      busy = capacity ? all.select { |slot| slot[:remaining].zero? } : []
      gap = (service["duration"] + rules.fetch("buffer_minutes", 0)).minutes
      all.reject do |slot|
        slot[:starts_at] < earliest || slot[:remaining]&.zero? || busy.any? { |other| other[:starts_at] != slot[:starts_at] && (other[:starts_at] - slot[:starts_at]).abs < gap }
      end
    end

    def times_for(service, date, exceptions)
      covering = exceptions.select { |item| covers?(item, service, date) }
      return if covering.any? { |item| item["kind"] == "closed" }

      special = covering.find { |item| item["kind"] == "special" }
      special ? special["times"] : service["times"]
    end

    def covers?(item, service, date)
      first = Date.iso8601(item["from"])
      last = Date.iso8601(item["to"] || item["from"])
      date.between?(first, last) && (item["service_ids"].blank? || item["service_ids"].include?(service["id"]))
    end

    def build(zone, date, time, capacity, booked)
      hours, minutes = time.split(":").map(&:to_i)
      local = zone.local(date.year, date.month, date.day, hours, minutes)
      return unless local.hour == hours && local.min == minutes

      starts_at = local.utc
      { starts_at: starts_at, date: date, time: time, remaining: capacity && capacity - booked.fetch(starts_at.to_i, 0) }
    end
  end
end
