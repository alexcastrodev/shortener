module Forms
  module BookingSchema
    extend self

    SERVICE_KEYS = ["id", "name", "duration", "price", "currency", "capacity", "days", "times"].freeze
    PUBLIC_SERVICE_KEYS = ["id", "name", "duration", "price", "currency", "days", "times"].freeze
    RULE_KEYS = ["time_zone", "approval", "approval_timeout_minutes", "approval_on_timeout", "min_notice_minutes", "window_days", "buffer_minutes", "max_per_day"].freeze
    RULE_RANGES = { "min_notice_minutes" => (0..43_200), "window_days" => (1..365), "buffer_minutes" => (0..600), "max_per_day" => (1..1000), "approval_timeout_minutes" => (5..43_200) }.freeze
    APPROVALS = ["auto", "manual"].freeze
    ON_TIMEOUT = ["decline", "accept"].freeze
    DEFAULT_TIMEOUT_MINUTES = 1440
    DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].freeze
    TIME = /\A([01]\d|2[0-3]):[0-5]\d\z/
    SERVICES_MAX = 20
    TIMES_MAX = 96
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
      services = field["services"]
      rules = field["rules"]
      return ["services must be a list"] unless services.is_a?(Array)
      return ["rules must be an object"] unless rules.is_a?(Hash)

      result = []
      result << "can have at most #{SERVICES_MAX} services" if services.size > SERVICES_MAX
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
      end
      result.concat(rule_errors(rules.stringify_keys))
      result.concat(exception_errors(field["exceptions"], ids))
    end

    def defaults(attributes, user)
      attributes = attributes.stringify_keys
      attributes["services"] ||= []
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

      blocks = []
      services = booking["services"].to_a
      blocks << "add at least one service" if services.empty?
      services.each do |service|
        blocks << "#{service["name"]} needs at least one day and one time" if service["days"].blank? || service["times"].blank?
      end
      answerable = fields.select { |field| field["required"] }
      blocks << "add a required email question to send the confirmation" unless answerable.any? { |field| field["type"] == "email" }
      blocks << "add a required short text question for the name" unless answerable.any? { |field| field["type"] == "short_text" }
      blocks
    end

    private

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

    def service_errors(service)
      result = []
      result << "has unknown keys" unless (service.keys - SERVICE_KEYS).empty?
      name = service["name"]
      result << "name is required (max #{NAME_MAX})" unless name.is_a?(String) && name.strip.present? && name.length <= NAME_MAX && !name.include?("\u0000")
      result << "duration must be between #{DURATION.min} and #{DURATION.max} minutes" unless service["duration"].is_a?(Integer) && DURATION.cover?(service["duration"])
      result.concat(price_errors(service))
      capacity = service["capacity"]
      result << "capacity must be between #{CAPACITY.min} and #{CAPACITY.max} or empty for unlimited" unless capacity.nil? || (capacity.is_a?(Integer) && CAPACITY.cover?(capacity))
      result << "days must be a list of #{DAYS.join(", ")}" unless service["days"].is_a?(Array) && (service["days"] - DAYS).empty? && service["days"].uniq.size == service["days"].size
      times = service["times"]
      result << "times must be unique HH:MM values (max #{TIMES_MAX})" unless times.is_a?(Array) && times.size <= TIMES_MAX && times.all? { |time| time.is_a?(String) && time.match?(TIME) } && times.uniq.size == times.size
      result
    end

    def price_errors(service)
      price = service["price"]
      currency = service["currency"]
      return [] if price.nil? && currency.nil?

      result = []
      result << "price must be between 0 and #{PRICE_MAX}" unless price.is_a?(Numeric) && price.to_f.finite? && price >= 0 && price <= PRICE_MAX
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
      result
    end
  end
end
