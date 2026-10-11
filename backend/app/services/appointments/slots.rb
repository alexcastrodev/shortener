module Appointments
  module Slots
    extend self

    MAX_RANGE_DAYS = 62
    WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].freeze

    def call(service:, rules:, from:, to:, now: Time.current, booked: {}, day_totals: {}, exceptions: [], lengths: {}, occupied: [], only: nil)
      zone = Time.find_zone!(rules.fetch("time_zone"))
      notice = rules.fetch("min_notice_minutes", 0).minutes
      last = [to, now.in_time_zone(zone).to_date + rules.fetch("window_days", 60), from + (MAX_RANGE_DAYS - 1)].min
      return [] if last < from

      (from..last).flat_map do |date|
        day_slots(service, rules, { zone: zone, date: date, earliest: now + notice, booked: booked, totals: day_totals, exceptions: exceptions, lengths: lengths, occupied: occupied, only: only })
      end
    end

    def offered?(service:, exceptions:, zone:, starts_at:)
      local = starts_at.in_time_zone(zone)
      date = local.to_date
      service["days"].include?(WEEKDAYS[date.wday]) && Array(times_for(service, date, exceptions)).include?(local.strftime("%H:%M"))
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
      holders = holders_of(service, all, booked)
      wanted = context[:only] || Durations.minutes(service)
      buffer = rules.fetch("buffer_minutes", 0).minutes
      lengths = context[:lengths]
      taken = context[:occupied]
      spans = holders.map { |at| [at, at + lengths.fetch(at.to_i, service["duration"]).minutes + buffer] }
      spans += taken.map { |other| [other[:starts_at], other[:starts_at] + other[:minutes].minutes + buffer] }
      all.filter_map do |slot|
        next if slot[:starts_at] < earliest || slot[:remaining]&.zero? || taken.any? { |other| other[:starts_at] == slot[:starts_at] }

        open = lengths.key?(slot[:starts_at].to_i) ? wanted & [lengths[slot[:starts_at].to_i]] : wanted
        fits = open.select { |minutes| fits?(slot[:starts_at], slot[:starts_at] + minutes.minutes + buffer, spans) }
        slot.merge(durations: fits) if fits.any?
      end
    end

    def holders_of(service, all, booked)
      return booked.select { |_, count| count.positive? }.keys.map { |at| Time.at(at).utc } if service["resource_key"].present?
      return [] unless service["capacity"]

      all.select { |slot| slot[:remaining].zero? }.map { |slot| slot[:starts_at] }
    end

    def fits?(starts_at, finish, spans)
      spans.none? { |from, to| from != starts_at && starts_at < to && from < finish }
    end

    def times_for(service, date, exceptions)
      covering = exceptions.select { |item| covers?(item, service, date) }
      return if covering.any? { |item| item["kind"] == "closed" }

      special = covering.find { |item| item["kind"] == "special" }
      special ? special["times"] : service.dig("times_by_day", WEEKDAYS[date.wday]) || service["times"]
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
