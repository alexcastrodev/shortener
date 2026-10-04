module Forms
  module FieldSchema
    extend self

    TYPES = ["short_text", "long_text", "email", "number", "single_choice", "multiple_choice", "yes_no", "rating", "date"].freeze
    CHOICE_TYPES = ["single_choice", "multiple_choice"].freeze
    ID_LENGTH = 8
    ID_FORMAT = /\A[A-Za-z0-9]{#{ID_LENGTH}}\z/
    LABEL_MAX = 300
    HELP_MAX = 500
    CHOICE_LABEL_MAX = 100
    SHORT_TEXT_MAX = 500
    LONG_TEXT_MAX = 5000
    EMAIL_MAX = 254
    EMAIL_DOMAIN = /@[^@\s]+\.[^@\s]+\z/
    NUMBER_LIMIT = 1_000_000_000_000
    NUMBER_DECIMALS = 4
    RATING_SCALES = [5, 10].freeze
    DATE_YEARS = (1900..2100)
    COMMON_KEYS = ["id", "type", "label", "help", "required"].freeze
    EXTRA_KEYS = {
      "single_choice" => ["choices"],
      "multiple_choice" => ["choices", "max_choices"],
      "rating" => ["scale"],
      "number" => ["min", "max"],
    }.freeze

    def definition_errors(fields)
      return ["must be an array"] unless fields.is_a?(Array)

      errors = []
      seen = {}
      fields.each_with_index do |raw, index|
        label = "field #{index + 1}"
        unless raw.is_a?(Hash)
          errors << "#{label} must be an object"
          next
        end

        field = raw.stringify_keys
        errors << "#{label} id is invalid or repeated" unless valid_id?(field["id"]) && !seen.key?(field["id"])
        seen[field["id"]] = true
        errors.concat(field_errors(field).map { |message| "#{label} #{message}" })
      end
      errors
    end

    def with_new_ids(field)
      field = field.stringify_keys
      field["id"] ||= new_id
      field["choices"] = field["choices"].map { |choice| choice.stringify_keys.tap { |c| c["id"] ||= new_id } } if field["choices"].is_a?(Array)
      field
    end

    def with_fresh_ids(field)
      field = field.stringify_keys.except("id")
      field["choices"] = field["choices"].map { |choice| choice.stringify_keys.except("id") } if field["choices"].is_a?(Array)
      with_new_ids(field)
    end

    def new_id
      SecureRandom.alphanumeric(ID_LENGTH)
    end

    def cast_answer(field, raw)
      field = field.stringify_keys
      return blank_answer(field) if blank?(raw)
      return [nil, :invalid] if contains_nul?(raw)

      case field["type"]
      when "short_text" then cast_text(raw, SHORT_TEXT_MAX)
      when "long_text" then cast_text(raw, LONG_TEXT_MAX)
      when "email" then cast_email(raw)
      when "number" then cast_number(field, raw)
      when "single_choice" then cast_single_choice(field, raw)
      when "multiple_choice" then cast_multiple_choice(field, raw)
      when "yes_no" then [true, false].include?(raw) ? [raw, nil] : [nil, :invalid]
      when "rating" then cast_rating(field, raw)
      when "date" then cast_date(raw)
      else [nil, :invalid]
      end
    end

    private

    def valid_id?(value)
      value.is_a?(String) && value.match?(ID_FORMAT)
    end

    def field_errors(field)
      errors = []
      type = field["type"]
      return ["has an unknown type"] unless TYPES.include?(type)

      allowed = COMMON_KEYS + EXTRA_KEYS.fetch(type, [])
      errors << "has unknown keys" unless (field.keys - allowed).empty?
      errors << "label is required (max #{LABEL_MAX})" unless text?(field["label"], LABEL_MAX, required: true)
      errors << "help is too long (max #{HELP_MAX})" unless text?(field["help"], HELP_MAX, required: false)
      errors << "required must be true or false" unless field["required"].nil? || [true, false].include?(field["required"])
      errors.concat(type_errors(field, type))
    end

    def type_errors(field, type)
      case type
      when "single_choice", "multiple_choice" then choice_errors(field)
      when "rating" then RATING_SCALES.include?(field["scale"]) ? [] : ["scale must be 5 or 10"]
      when "number" then number_bound_errors(field)
      else []
      end
    end

    def choice_errors(field)
      choices = field["choices"]
      return ["needs at least 2 choices"] unless choices.is_a?(Array) && choices.size >= 2

      errors = []
      ids = []
      choices.each do |choice|
        unless choice.is_a?(Hash)
          errors << "has an invalid choice"
          next
        end

        choice = choice.stringify_keys
        errors << "has an invalid choice id" unless valid_id?(choice["id"]) && !ids.include?(choice["id"])
        errors << "has an invalid choice label" unless text?(choice["label"], CHOICE_LABEL_MAX, required: true) && (choice.keys - ["id", "label"]).empty?
        ids << choice["id"]
      end
      max = field["max_choices"]
      errors << "max_choices is out of range" unless max.nil? || (max.is_a?(Integer) && max.between?(1, choices.size))
      errors
    end

    def number_bound_errors(field)
      min = field["min"]
      max = field["max"]
      return ["min and max must be numbers"] unless [min, max].all? { |bound| bound.nil? || bound_number?(bound) }
      return ["min is greater than max"] if min && max && min > max

      []
    end

    def bound_number?(value)
      value.is_a?(Numeric) && value.to_f.finite? && value.abs <= NUMBER_LIMIT
    end

    def text?(value, max, required:)
      return !required if value.nil?

      value.is_a?(String) && value.length <= max && !contains_nul?(value) && (!required || value.strip.present?)
    end

    def contains_nul?(value)
      case value
      when String then value.include?("\u0000")
      when Array then value.any? { |item| contains_nul?(item) }
      else false
      end
    end

    def blank?(raw)
      raw.nil? || (raw.is_a?(String) && raw.strip.empty?) || raw == []
    end

    def blank_answer(field)
      field["required"] ? [nil, :blank] : [nil, nil]
    end

    def cast_text(raw, max)
      return [nil, :invalid] unless raw.is_a?(String)

      raw.strip.length > max ? [nil, :too_long] : [raw.strip, nil]
    end

    def cast_email(raw)
      return [nil, :invalid] unless raw.is_a?(String)

      email = raw.strip
      return [nil, :too_long] if email.length > EMAIL_MAX

      valid = email.match?(URI::MailTo::EMAIL_REGEXP) && email.match?(EMAIL_DOMAIN) && !email.match?(/\s/)
      valid ? [email, nil] : [nil, :invalid]
    end

    def cast_number(field, raw)
      return [nil, :invalid] unless raw.is_a?(Numeric) || (raw.is_a?(String) && raw.strip.match?(/\A-?\d+(\.\d+)?\z/))

      number = raw.is_a?(String) ? BigDecimal(raw.strip) : BigDecimal(raw.to_s)
      return [nil, :invalid] unless number.finite?
      return [nil, :invalid] if number.scale > NUMBER_DECIMALS
      return [nil, :out_of_range] if number.abs > NUMBER_LIMIT
      return [nil, :out_of_range] if field["min"] && number < field["min"]
      return [nil, :out_of_range] if field["max"] && number > field["max"]

      [number.frac.zero? ? number.to_i : number.to_f, nil]
    rescue ArgumentError, FloatDomainError
      [nil, :invalid]
    end

    def choice_ids(field)
      Array(field["choices"]).map { |choice| choice.stringify_keys["id"] }
    end

    def cast_single_choice(field, raw)
      choice_ids(field).include?(raw) ? [raw, nil] : [nil, :invalid]
    end

    def cast_multiple_choice(field, raw)
      return [nil, :invalid] unless raw.is_a?(Array) && raw.all?(String)
      return [nil, :invalid] unless raw.uniq.size == raw.size && (raw - choice_ids(field)).empty?

      max = field["max_choices"] || choice_ids(field).size
      raw.size > max ? [nil, :too_many] : [raw, nil]
    end

    def cast_rating(field, raw)
      return [nil, :invalid] unless raw.is_a?(Integer)

      raw.between?(1, field["scale"]) ? [raw, nil] : [nil, :out_of_range]
    end

    def cast_date(raw)
      return [nil, :invalid] unless raw.is_a?(String) && raw.match?(/\A\d{4}-\d{2}-\d{2}\z/)

      date = Date.iso8601(raw)
      DATE_YEARS.cover?(date.year) ? [raw, nil] : [nil, :out_of_range]
    rescue Date::Error
      [nil, :invalid]
    end
  end
end
