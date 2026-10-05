module Forms
  module BookingSchema
    extend self

    SERVICE_KEYS = ["id", "name", "duration", "price", "currency", "capacity", "days", "times"].freeze
    PUBLIC_SERVICE_KEYS = ["id", "name", "duration", "price", "currency", "days", "times"].freeze
    RULE_KEYS = ["time_zone", "approval", "min_notice_minutes", "window_days", "buffer_minutes", "max_per_day"].freeze
    RULE_RANGES = { "min_notice_minutes" => (0..43_200), "window_days" => (1..365), "buffer_minutes" => (0..600), "max_per_day" => (1..1000) }.freeze
    APPROVALS = ["auto"].freeze
    DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].freeze
    TIME = /\A([01]\d|2[0-3]):[0-5]\d\z/
    SERVICES_MAX = 20
    TIMES_MAX = 96
    NAME_MAX = 100
    DURATION = (5..600)
    CAPACITY = (1..1000)
    PRICE_MAX = 1_000_000
    CURRENCY = /\A[A-Z]{3}\z/

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
    end

    def defaults(attributes, user)
      attributes = attributes.stringify_keys
      attributes["services"] ||= []
      rules = (attributes["rules"] || {}).stringify_keys
      rules["time_zone"] ||= user.time_zone
      rules["approval"] ||= "auto"
      rules["min_notice_minutes"] = 0 unless rules.key?("min_notice_minutes")
      rules["window_days"] ||= 60
      rules["buffer_minutes"] ||= 0
      attributes.merge("rules" => rules)
    end

    def with_new_ids(field)
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
      RULE_RANGES.each do |key, range|
        value = rules[key]
        result << "#{key.tr("_", " ")} must be a whole number from #{range.min} to #{range.max}" unless value.nil? || (value.is_a?(Integer) && range.cover?(value))
      end
      result
    end
  end
end
