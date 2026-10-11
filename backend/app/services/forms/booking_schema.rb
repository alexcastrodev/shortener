module Forms
  module BookingSchema
    extend self

    SERVICE_KEYS = ["id", "category_id", "name", "duration", "price", "currency", "capacity", "days", "times", "times_by_day", "extra_durations", "monthly"].freeze
    PUBLIC_SERVICE_KEYS = ["id", "category_id", "name", "duration", "price", "currency", "days", "times", "extra_durations", "monthly"].freeze
    RULE_KEYS = ["time_zone", "approval", "approval_timeout_minutes", "approval_on_timeout", "approval_within_minutes", "verify_email", "waitlist", "waitlist_confirm_minutes", "multiple_services", "reminder_minutes", "min_notice_minutes", "window_days", "buffer_minutes", "max_per_day"].freeze
    RULE_RANGES = { "min_notice_minutes" => (0..43_200), "window_days" => (1..365), "buffer_minutes" => (0..600), "max_per_day" => (1..1000), "approval_timeout_minutes" => (5..43_200), "approval_within_minutes" => (1..43_200), "waitlist_confirm_minutes" => (15..4_320) }.freeze
    APPROVALS = ["auto", "manual"].freeze
    ON_TIMEOUT = ["decline", "accept"].freeze
    DEFAULT_TIMEOUT_MINUTES = 1440
    VERIFY_MINUTES = 15
    REMINDER_RANGE = (15..10_080)
    REMINDERS_MAX = 3
    DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].freeze
    TIME = /\A([01]\d|2[0-3]):[0-5]\d\z/
    SERVICES_MAX = 20
    CATEGORIES_MAX = 10
    CATEGORY_KEYS = ["id", "name"].freeze
    CATEGORY_NAME_MAX = 60
    TIMES_MAX = 96
    SCHEDULE_KEYS = ["category_id", "days", "times", "times_by_day"].freeze
    EXTRA_DURATIONS_MAX = 4
    MONTHLY_KEYS = ["price", "duration", "sessions", "per"].freeze
    ALLOWANCE_PERIODS = ["month", "week"].freeze
    NAME_MAX = 100
    DURATION = (5..600)
    CAPACITY = (1..1000)
    PRICE_MAX = 1_000_000
    CURRENCY = /\A[A-Z]{3}\z/
    EXCEPTION_KEYS = ["id", "from", "to", "kind", "times", "service_ids", "note"].freeze
    EXCEPTION_KINDS = ["closed", "special"].freeze
    EXCEPTIONS_MAX = 100
    EXCEPTION_NOTE_MAX = 200
    EXCEPTION_SPAN_MAX = 366
    DATE = /\A\d{4}-\d{2}-\d{2}\z/

    def errors(field)
      mode = Booking::Modes.fetch(field["mode"])
      mode ? mode.errors(field) : ["mode must be one of #{Booking::Modes::NAMES.join(", ")}"]
    end

    def services_errors(field)
      services = field["services"]
      rules = field["rules"]
      return ["services must be a list"] unless services.is_a?(Array)
      return ["rules must be an object"] unless rules.is_a?(Hash)

      result = []
      result << "can have at most #{SERVICES_MAX} services" if services.size > SERVICES_MAX
      result << "availability belongs to the individual mode" if field.key?("availability")
      category_ids = []
      result.concat(category_errors(field["categories"], category_ids))
      ids = []
      services.each_with_index do |raw, index|
        label = "service #{index + 1}"
        unless raw.is_a?(Hash)
          result << "#{label} must be an object"
          next
        end

        service = raw.stringify_keys
        result << "#{label} id is invalid or repeated" unless service["id"].to_s.match?(FieldSchema::ID_FORMAT) && !ids.include?(service["id"])
        ids << service["id"]
        result.concat(service_errors(service).map { |message| "#{label} #{message}" })
        result.concat(category_link_errors(service, category_ids).map { |message| "#{label} #{message}" })
      end
      result.concat(rule_errors(rules.stringify_keys))
      result.concat(multiple_rule_errors(field))
      result.concat(exception_errors(field["exceptions"], ids))
    end

    def multiple_rule_errors(field)
      return [] unless field.dig("rules", "multiple_services") == true

      result = []
      result << "several services in one booking is not available with categories" if field["categories"].to_a.size >= 2
      currencies = field["services"].to_a.grep(Hash).filter_map { |service| service["currency"] if service["price"] }.uniq
      result << "several services in one booking need every price in the same currency" if currencies.size > 1
      result
    end

    def defaults(attributes, user)
      attributes = attributes.stringify_keys
      attributes["services"] ||= []
      attributes["categories"] ||= []
      attributes["exceptions"] ||= []
      rules = (attributes["rules"] || {}).stringify_keys
      rules["time_zone"] ||= user.time_zone
      rules["approval"] ||= "auto"
      if rules["approval"] == "manual"
        rules["approval_timeout_minutes"] ||= DEFAULT_TIMEOUT_MINUTES
        rules["approval_on_timeout"] ||= "decline"
      end
      rules["min_notice_minutes"] = 0 unless rules.key?("min_notice_minutes")
      rules["window_days"] ||= 60
      rules["buffer_minutes"] ||= 0
      attributes.merge("rules" => rules)
    end

    def with_new_ids(field)
      field = field.merge("categories" => field["categories"].map { |item| item.is_a?(Hash) ? item.stringify_keys.tap { |row| row["id"] ||= FieldSchema.new_id } : item }) if field["categories"].is_a?(Array)
      field = field.merge("exceptions" => field["exceptions"].map { |item| item.is_a?(Hash) ? item.stringify_keys.tap { |row| row["id"] ||= FieldSchema.new_id } : item }) if field["exceptions"].is_a?(Array)
      return field unless field["services"].is_a?(Array)

      field.merge("services" => field["services"].map { |service| service.is_a?(Hash) ? service.stringify_keys.tap { |item| item["id"] ||= FieldSchema.new_id } : service })
    end

    def added?(fields, previous)
      current = Array(fields).select { |field| field.is_a?(Hash) && field["type"] == "booking" }
      before = Array(previous).select { |field| field.is_a?(Hash) && field["type"] == "booking" }
      (current - before).any?
    end

    def publish_blocks(fields)
      booking = Array(fields).find { |field| field["type"] == "booking" }
      return [] unless booking

      Booking::Modes.fetch(booking["mode"])&.publish_blocks(fields) || []
    end

    def services_publish_blocks(fields)
      booking = Array(fields).find { |field| field["type"] == "booking" }
      blocks = []
      services = booking["services"].to_a
      blocks << block("no_service", "add at least one service") if services.empty?
      services.each do |service|
        blocks << block("service_incomplete", "#{service["name"]} needs at least one day and one time", name: service["name"], service_id: service["id"]) if service["days"].blank? || service["times"].blank?
      end
      blocks.concat(common_blocks(fields, booking))
    end

    def common_blocks(fields, booking)
      blocks = []
      answerable = fields.select { |field| field["required"] }
      if booking.dig("rules", "waitlist") == true
        extra = answerable.reject { |field| ["booking"].include?(field["type"]) }.group_by { |field| field["type"] }
        blocks << block("waitlist_questions", "the waiting list works only with a name, an email and the booking as required questions") if (extra.keys - ["short_text", "email"]).any? || extra.values.any? { |list| list.size > 1 }
      end
      blocks << block("no_email", "add a required email question to send the verification code") if booking.dig("rules", "verify_email") == true && answerable.none? { |field| field["type"] == "email" }
      blocks
    end

    private

    def block(code, message, name: nil, service_id: nil)
      { code: code, message: message, name: name, service_id: service_id }.compact
    end

    def category_errors(list, ids)
      return [] if list.nil?
      return ["categories must be a list"] unless list.is_a?(Array)

      result = []
      result << "can have at most #{CATEGORIES_MAX} categories" if list.size > CATEGORIES_MAX
      list.each_with_index do |raw, index|
        label = "category #{index + 1}"
        unless raw.is_a?(Hash)
          result << "#{label} must be an object"
          next
        end

        item = raw.stringify_keys
        result << "#{label} has unknown keys" unless (item.keys - CATEGORY_KEYS).empty?
        result << "#{label} id is invalid or repeated" unless item["id"].to_s.match?(FieldSchema::ID_FORMAT) && !ids.include?(item["id"])
        ids << item["id"]
        name = item["name"]
        result << "#{label} name is required (max #{CATEGORY_NAME_MAX})" unless name.is_a?(String) && name.strip.present? && name.length <= CATEGORY_NAME_MAX && !name.include?("\u0000")
      end
      result
    end

    def category_link_errors(service, category_ids)
      id = service["category_id"]
      return ["needs a category"] if id.nil? && category_ids.size >= 2
      return [] if id.nil?

      category_ids.include?(id) ? [] : ["category is unknown"]
    end

    def exception_errors(list, service_ids)
      return [] if list.nil?
      return ["exceptions must be a list"] unless list.is_a?(Array)

      result = []
      result << "can have at most #{EXCEPTIONS_MAX} exceptions" if list.size > EXCEPTIONS_MAX
      seen = []
      list.each_with_index do |raw, index|
        label = "exception #{index + 1}"
        unless raw.is_a?(Hash)
          result << "#{label} must be an object"
          next
        end

        item = raw.stringify_keys
        result << "#{label} id is invalid or repeated" unless item["id"].to_s.match?(FieldSchema::ID_FORMAT) && !seen.include?(item["id"])
        seen << item["id"]
        result.concat(exception_item_errors(item, service_ids).map { |message| "#{label} #{message}" })
      end
      result
    end

    def exception_item_errors(item, service_ids)
      result = []
      result << "has unknown keys" unless (item.keys - EXCEPTION_KEYS).empty?
      first = parse_date(item["from"])
      last = parse_date(item["to"] || item["from"])
      result << "dates must look like 2026-12-25" unless first && last
      result << "must not end before it starts or last more than #{EXCEPTION_SPAN_MAX} days" if first && last && (last < first || (last - first) >= EXCEPTION_SPAN_MAX)
      result << "kind must be one of #{EXCEPTION_KINDS.join(", ")}" unless EXCEPTION_KINDS.include?(item["kind"])
      times = item["times"]
      if item["kind"] == "special"
        result << "needs unique HH:MM times (max #{TIMES_MAX})" unless times.is_a?(Array) && times.any? && times.size <= TIMES_MAX && times.all? { |time| time.is_a?(String) && time.match?(TIME) } && times.uniq.size == times.size
      elsif !times.nil?
        result << "closed days take no times"
      end
      ids = item["service_ids"]
      result << "service_ids must list services of this question" unless ids.nil? || (ids.is_a?(Array) && ids.size <= SERVICES_MAX && (ids - service_ids).empty? && ids.uniq.size == ids.size)
      note = item["note"]
      result << "note is too long (max #{EXCEPTION_NOTE_MAX})" unless note.nil? || (note.is_a?(String) && note.length <= EXCEPTION_NOTE_MAX && !note.include?("\u0000"))
      result
    end

    def parse_date(value)
      Date.iso8601(value) if value.is_a?(String) && value.match?(DATE)
    rescue Date::Error
      nil
    end

    def service_errors(service, schedule: true)
      result = []
      result << "has unknown keys" unless (service.keys - (schedule ? SERVICE_KEYS : SERVICE_KEYS - SCHEDULE_KEYS)).empty?
      name = service["name"]
      result << "name is required (max #{NAME_MAX})" unless name.is_a?(String) && name.strip.present? && name.length <= NAME_MAX && !name.include?("\u0000")
      result << "duration must be between #{DURATION.min} and #{DURATION.max} minutes" unless service["duration"].is_a?(Integer) && DURATION.cover?(service["duration"])
      result.concat(price_errors(service))
      capacity = service["capacity"]
      result << "capacity must be between #{CAPACITY.min} and #{CAPACITY.max} or empty for unlimited" unless capacity.nil? || (capacity.is_a?(Integer) && CAPACITY.cover?(capacity))
      result.concat(schedule_errors(service)) if schedule
      result.concat(extra_duration_errors(service))
      result.concat(monthly_errors(service))
      result
    end

    def schedule_errors(schedule)
      result = []
      result << "days must be a list of #{DAYS.join(", ")}" unless schedule["days"].is_a?(Array) && (schedule["days"] - DAYS).empty? && schedule["days"].uniq.size == schedule["days"].size
      times = schedule["times"]
      result << "times must be unique HH:MM values (max #{TIMES_MAX})" unless times.is_a?(Array) && times.size <= TIMES_MAX && times.all? { |time| time.is_a?(String) && time.match?(TIME) } && times.uniq.size == times.size
      result.concat(by_day_errors(schedule))
    end

    def monthly_errors(service)
      monthly = service["monthly"]
      return [] if monthly.nil?
      return ["monthly must be an object"] unless monthly.is_a?(Hash) && (monthly.keys - MONTHLY_KEYS).empty?

      result = []
      duration = monthly["duration"]
      result << "monthly duration must be between #{DURATION.min} and #{DURATION.max} minutes" unless duration.nil? || (duration.is_a?(Integer) && DURATION.cover?(duration))
      result.concat(allowance_errors(monthly))
      price = monthly["price"]
      return result if price.nil?

      result << "monthly price must be between 0 and #{PRICE_MAX}" unless valid_price?(price)
      result << "monthly price needs a currency" unless service["currency"].is_a?(String) && service["currency"].match?(CURRENCY)
      result
    end

    def allowance_errors(monthly)
      sessions = monthly["sessions"]
      per = monthly["per"]
      result = []
      result << "monthly per must be one of #{ALLOWANCE_PERIODS.join(", ")}" unless per.nil? || ALLOWANCE_PERIODS.include?(per)
      return result << "monthly per needs the number of sessions" if sessions.nil? && !per.nil?
      return result if sessions.nil?

      limit = per == "week" ? 7 : 31
      result << "monthly sessions must be a whole number from 1 to #{limit}" unless sessions.is_a?(Integer) && (1..limit).cover?(sessions)
      result
    end

    def extra_duration_errors(service)
      extras = service["extra_durations"]
      return [] if extras.nil?
      return ["extra durations must be a list of at most #{EXTRA_DURATIONS_MAX}"] unless extras.is_a?(Array) && extras.size <= EXTRA_DURATIONS_MAX

      seen = [service["duration"]]
      extras.flat_map do |extra|
        next ["extra durations must each have a duration and a price"] unless extra.is_a?(Hash) && (extra.keys - ["duration", "price"]).empty?

        minutes = extra["duration"]
        result = []
        result << "extra duration must be between #{DURATION.min} and #{DURATION.max} minutes" unless minutes.is_a?(Integer) && DURATION.cover?(minutes)
        result << "extra durations must differ from each other and from the service duration" if seen.include?(minutes)
        seen << minutes
        result << "extra duration price must be between 0 and #{PRICE_MAX}" unless extra["price"].nil? || valid_price?(extra["price"])
        result << "extra durations need a price exactly when the service has one" if extra["price"].nil? != service["price"].nil?
        result
      end.uniq
    end

    def valid_price?(price) = price.is_a?(Numeric) && price.to_f.finite? && price >= 0 && price <= PRICE_MAX

    def by_day_errors(service)
      by_day = service["times_by_day"]
      return [] if by_day.nil?
      return ["times by day must be an object"] unless by_day.is_a?(Hash)

      days = Array(service["days"])
      result = []
      result << "times by day can only use the days the service runs" unless (by_day.keys - days).empty?
      by_day.each_value do |list|
        result << "times by day must be unique HH:MM values (max #{TIMES_MAX})" unless list.is_a?(Array) && list.size <= TIMES_MAX && list.all? { |time| time.is_a?(String) && time.match?(TIME) } && list.uniq.size == list.size
      end
      result
    end

    def price_errors(service)
      price = service["price"]
      currency = service["currency"]
      return [] if price.nil? && currency.nil?

      result = []
      result << "price must be between 0 and #{PRICE_MAX}" unless valid_price?(price)
      result << "currency must be a 3-letter code" unless currency.is_a?(String) && currency.match?(CURRENCY)
      result
    end

    def rule_errors(rules)
      result = []
      result << "rules have unknown keys" unless (rules.keys - RULE_KEYS).empty?
      result << "time zone is invalid" unless TZInfo::Timezone.all_identifiers.include?(rules["time_zone"])
      result << "approval must be one of #{APPROVALS.join(", ")}" unless APPROVALS.include?(rules["approval"])
      result << "approval on timeout must be one of #{ON_TIMEOUT.join(", ")}" unless rules["approval_on_timeout"].nil? || ON_TIMEOUT.include?(rules["approval_on_timeout"])
      RULE_RANGES.each do |key, range|
        value = rules[key]
        result << "#{key.tr("_", " ")} must be a whole number from #{range.min} to #{range.max}" unless value.nil? || (value.is_a?(Integer) && range.cover?(value))
      end
      result << "waitlist must be true or false" unless [nil, true, false].include?(rules["waitlist"])
      result << "multiple services must be true or false" unless [nil, true, false].include?(rules["multiple_services"])
      result << "verify email must be true or false" unless [nil, true, false].include?(rules["verify_email"])
      result << "reminder minutes must be up to #{REMINDERS_MAX} different whole numbers from #{REMINDER_RANGE.min} to #{REMINDER_RANGE.max}" unless valid_reminders?(rules["reminder_minutes"])
      result
    end

    def valid_reminders?(list)
      list.nil? || (list.is_a?(Array) && list.size <= REMINDERS_MAX && list.uniq.size == list.size && list.all? { |value| value.is_a?(Integer) && REMINDER_RANGE.cover?(value) })
    end

    public(:block, :rule_errors, :exception_errors, :service_errors, :schedule_errors, :multiple_rule_errors)
  end
end
