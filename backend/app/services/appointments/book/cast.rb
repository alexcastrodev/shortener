module Appointments
  module Book
    module Cast
      extend self

      def cast(form:, booking:, raw:, now: Time.current, claim_at: nil)
        return [nil, :invalid] unless raw.is_a?(Hash)

        entries = raw.key?("items") ? items_of(raw, booking, claim_at) : [raw]
        return [nil, :invalid] unless entries

        items = []
        entries.each do |entry|
          item, error, detail = cast_item(form: form, booking: booking, raw: entry, now: now, claim_at: claim_at)
          return [nil, error, detail] if error

          items << item
        end
        clash = clash_of(form, booking["rules"], items)
        return [nil, :unavailable, clash.presence] if clash

        [{ "items" => items, "stored" => stored(raw, items) }, nil]
      rescue Date::Error
        [nil, :invalid]
      end

      def items_of(raw, booking, claim_at)
        list = raw["items"]
        return unless booking.dig("rules", "multiple_services") == true && claim_at.nil? && (raw.keys - ["items"]).empty?
        return unless list.is_a?(Array) && list.size.between?(1, ITEMS_MAX) && list.all?(Hash) && list.pluck("service").uniq.size == list.size

        chosen = booking["services"].select { |service| list.pluck("service").include?(service["id"]) }
        list if chosen.filter_map { |service| service["currency"] if service["price"] }.uniq.size <= 1
      end

      def stored(raw, items)
        return { "items" => items.map { |item| item.slice("service", "sessions") } } if raw.key?("items")

        items.first.slice("service", "sessions")
      end

      def clash_of(form, rules, items)
        overlap = overlap_of(items, rules.fetch("buffer_minutes", 0))
        return overlap if overlap

        {} if over_daily_limit?(form, rules, items.flat_map { |item| item["sessions"] })
      end

      def refused(service, session)
        [nil, :unavailable, { "service" => service["id"], "date" => session["date"], "time" => session["time"] }]
      end

      def cast_item(form:, booking:, raw:, now:, claim_at:)
        return [nil, :invalid] unless raw.is_a?(Hash)

        service = booking["services"].find { |item| item["id"] == raw["service"] }
        return cast_monthly(form: form, booking: booking, service: service, raw: raw["monthly"], now: now) if service && raw["monthly"]

        sessions = raw["sessions"]
        return [nil, :invalid] unless service && valid_sessions?(sessions, service)

        dates = sessions.map { |session| Date.iso8601(session["date"]) }
        return [nil, :invalid] if dates.max - dates.min >= Slots::MAX_RANGE_DAYS

        free = FreeSlots.call(form: form, booking: booking, service: service, from: dates.min, to: dates.max, now: now, releasing: claim_at)
        lengths = sessions.map { |session| session["duration"] || service["duration"] }
        times = sessions.zip(lengths).map do |session, minutes|
          free.find { |slot| slot[:date].iso8601 == session["date"] && slot[:time] == session["time"] && slot[:durations].include?(minutes) }
        end
        missed = times.index(&:nil?)
        return refused(service, sessions[missed]) if missed

        item = {
          "service" => service["id"],
          "sessions" => sessions.zip(lengths).map { |session, minutes| session.slice("date", "time").merge("duration" => minutes) },
          "starts_at" => times.map { |slot| slot[:starts_at] },
          "durations" => lengths,
          "capacity" => service["capacity"],
        }
        [item, nil]
      end

      def cast_plan(form:, booking:, service:, raw:, now:)
        plan = service["monthly"]
        return [nil, :invalid] unless raw.is_a?(Hash) && raw["month"].to_s.match?(/\A\d{4}-\d{2}\z/)

        picks = raw["sessions"]
        return [nil, :invalid] unless picks.is_a?(Array) && picks.size.between?(1, MAX_SESSIONS) && picks.all? { |pick| valid_pick?(pick) }
        return [nil, :invalid] unless picks.map { |pick| pick.values_at("date", "time") }.uniq.size == picks.size

        rules = booking["rules"]
        today = now.in_time_zone(Time.find_zone!(rules["time_zone"])).to_date
        month = Date.strptime(raw["month"], "%Y-%m")
        return [nil, :invalid] unless [today.beginning_of_month, today.beginning_of_month.next_month].include?(month)

        dates = picks.map { |pick| Date.iso8601(pick["date"]) }
        return [nil, :invalid] unless dates.all? { |date| date.beginning_of_month == month && date >= today }
        return [nil, :invalid] if over_allowance?(plan, dates)

        minutes = Durations.monthly_minutes(service)
        free = FreeSlots.call(form: form, booking: booking, service: service, from: dates.min, to: dates.max, now: now, only: [minutes])
        found = picks.map { |pick| free.find { |slot| slot[:date].iso8601 == pick["date"] && slot[:time] == pick["time"] } }
        missed = found.index(&:nil?)
        return refused(service, picks[missed]) if missed

        [monthly_item(service, found.sort_by { |slot| slot[:starts_at] }, minutes, raw["month"], []), nil]
      rescue Date::Error
        [nil, :invalid]
      end

      def over_allowance?(plan, dates)
        allowed = plan["sessions"]
        return dates.size > allowed unless plan["per"] == "week"

        dates.group_by { |date| date.beginning_of_week(:monday) }.values.any? { |week| week.size > allowed }
      end

      def cast_monthly(form:, booking:, service:, raw:, now:)
        return cast_plan(form: form, booking: booking, service: service, raw: raw, now: now) if service.dig("monthly", "sessions")
        return [nil, :invalid] unless service["monthly"].is_a?(Hash) && raw.is_a?(Hash) && raw["time"].to_s.match?(TIME) && raw["month"].to_s.match?(/\A\d{4}-\d{2}\z/)

        weekdays = raw["weekdays"]
        return [nil, :invalid] unless weekdays.is_a?(Array) && weekdays.size.between?(1, 7) && weekdays.uniq.size == weekdays.size && (weekdays - Forms::BookingSchema::DAYS).empty?

        rules = booking["rules"]
        zone = Time.find_zone!(rules["time_zone"])
        today = now.in_time_zone(zone).to_date
        month = Date.strptime(raw["month"], "%Y-%m")
        return [nil, :invalid] unless [today.beginning_of_month, today.beginning_of_month.next_month].include?(month)

        from = [month, today].max
        wanted = (from..month.end_of_month).select { |date| weekdays.include?(Slots::WEEKDAYS[date.wday]) }
        minutes = Durations.monthly_minutes(service)
        offered = Slots.call(service: service, rules: rules, from: from, to: month.end_of_month, now: now, exceptions: booking["exceptions"].to_a, only: [minutes])
        free = FreeSlots.call(form: form, booking: booking, service: service, from: from, to: month.end_of_month, now: now, only: [minutes])
        picked = []
        skipped = []
        wanted.each do |date|
          next skipped << date.iso8601 unless offered.any? { |slot| slot[:date] == date && slot[:time] == raw["time"] }

          slot = free.find { |item| item[:date] == date && item[:time] == raw["time"] }
          return refused(service, { "date" => date.iso8601, "time" => raw["time"] }) unless slot

          picked << slot
        end
        return [nil, :unavailable, { "service" => service["id"] }] if picked.empty?

        [monthly_item(service, picked, minutes, raw["month"], skipped), nil]
      rescue Date::Error
        [nil, :invalid]
      end

      private

      def monthly_item(service, slots, minutes, month, skipped)
        {
          "service" => service["id"],
          "sessions" => slots.map { |slot| { "date" => slot[:date].iso8601, "time" => slot[:time], "duration" => minutes } },
          "starts_at" => slots.map { |slot| slot[:starts_at] },
          "durations" => slots.map { minutes },
          "capacity" => service["capacity"],
          "monthly" => { "month" => month, "skipped" => skipped },
        }
      end

      def overlap_of(items, buffer)
        spans = items.flat_map do |item|
          item["starts_at"].zip(item["durations"], item["sessions"]).map do |at, minutes, session|
            { from: at, to: at + (minutes + buffer).minutes, service: item["service"], session: session }
          end
        end
        _, later = spans.combination(2).find { |first, second| first[:from] < second[:to] && second[:from] < first[:to] }
        { "service" => later[:service], "date" => later[:session]["date"], "time" => later[:session]["time"] } if later
      end

      def over_daily_limit?(form, rules, sessions)
        limit = rules["max_per_day"]
        return false unless limit

        zone = Time.find_zone!(rules["time_zone"])
        sessions.group_by { |session| session["date"] }.any? do |date, group|
          next false if group.size == 1

          Book.day_total(form, zone, Date.iso8601(date)) + group.size > limit
        end
      end

      def valid_pick?(pick)
        pick.is_a?(Hash) && pick["date"].is_a?(String) && pick["date"].match?(DATE) && pick["time"].is_a?(String) && pick["time"].match?(TIME)
      end

      def valid_sessions?(sessions, service)
        minutes = Durations.minutes(service)
        sessions.is_a?(Array) && sessions.size.between?(1, MAX_SESSIONS) &&
          sessions.all? { |session| valid_pick?(session) && (session["duration"].nil? || (session["duration"].is_a?(Integer) && minutes.include?(session["duration"]))) } &&
          sessions.map { |session| session.values_at("date", "time") }.uniq.size == sessions.size
      end
    end
  end
end
