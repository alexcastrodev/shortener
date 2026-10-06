module Forms
  class SubmitResponse
    include Callable

    Result = Data.define(:response, :errors, :created)

    META_MAX = 40

    class ClaimFailed < StandardError; end

    class FormChanged < StandardError
      attr_reader :definition

      def initialize(definition)
        @definition = definition
        super("form_changed")
      end
    end

    def initialize(form:, answers:, idempotency_key: nil, meta: {}, version: nil, client: {}, claim_at: nil)
      @form = form
      @version = version
      @client = client
      @claim_at = claim_at
      @answers = answers
      @idempotency_key = idempotency_key.presence&.to_s&.first(64)
      @meta = meta
    end

    def call
      existing = find_existing
      return Result.new(existing, nil, false) if existing

      return Result.new(nil, { "answers" => ["invalid"] }, false) unless answers.is_a?(Hash)

      raise FormChanged, definition if stale?

      @claims = []
      values, errors = cast_all
      return Result.new(nil, errors, false) if errors.any?

      create(values)
    end

    private

    attr_reader :form, :answers, :idempotency_key, :meta, :version, :client, :claim_at

    def definition
      @definition ||= PublicDefinition.for(form)
    end

    def stale?
      version.present? && version.to_i != definition.published_version
    end

    def cast_all
      values = {}
      errors = {}
      definition.fields.select { |field| FieldSchema.answerable?(field) }.each do |field|
        value, error = cast_field(field)
        if error
          errors[field["id"]] = [error.to_s]
        elsif !value.nil?
          values[field["id"]] = value
        end
      end
      [values, errors]
    end

    def cast_field(field)
      raw = answers[field["id"]]
      case field["type"]
      when "booking" then cast_booking(field, raw)
      when "image" then cast_image(field, raw)
      else FieldSchema.cast_answer(field, raw)
      end
    end

    def cast_booking(field, raw)
      return [nil, :blank] if raw.nil? || raw == ""

      value, error = Appointments::Book.cast(form: form, booking: field, raw: raw, claim_at: claim_at)
      @booking = value
      [value&.slice("service", "sessions"), error]
    end

    def contact(values)
      fields = definition.fields
      email_id = fields.find { |field| field["type"] == "email" && field["required"] }&.fetch("id")
      name_id = fields.find { |field| field["type"] == "short_text" && field["required"] }&.fetch("id")
      { email: values[email_id], name: values[name_id] }
    end

    def cast_image(field, raw)
      return FieldSchema.cast_answer(field, raw) if raw.nil? || (raw.is_a?(String) && raw.strip.empty?)
      return [nil, :invalid] unless raw.is_a?(String) && raw.match?(FormUpload::TOKEN_FORMAT)

      upload = form.uploads.find_by(token: raw, field_id: field["id"], response_id: nil)
      return [nil, :invalid] unless upload

      @claims << upload
      [raw, nil]
    end

    def create(values)
      ActiveRecord::Base.transaction do
        response = form.responses.create!(attributes.merge(answers: values))
        claimed = @claims.all? { |upload| FormUpload.where(id: upload.id, response_id: nil).update_all(response_id: response.id) == 1 }
        raise ClaimFailed unless claimed

        book(response, values)
        Result.new(response, nil, true)
      end
    rescue ClaimFailed
      Result.new(nil, { "answers" => ["invalid"] }, false)
    rescue ActiveRecord::RecordNotUnique
      existing = find_existing
      raise unless existing

      Result.new(existing, nil, false)
    end

    def book(response, values)
      return unless @booking

      meta = { time_zone: Appointments::Book.valid_zone(client[:time_zone]), locale: Appointments::Book.valid_locale(client[:locale]) }
      Appointments::Book.call(form: form, response: response, value: @booking, contact: contact(values), meta: meta, version: definition.published_version, held: claim_at.present?)
    end

    def attributes
      {
        idempotency_key: idempotency_key,
        published_version: definition.published_version,
        country: country,
        platform: text(:platform),
        browser: text(:browser),
        source: text(:source),
      }
    end

    def country
      value = meta[:country].to_s
      value.match?(/\A[A-Z]{2}\z/) ? value : nil
    end

    def text(key)
      meta[key].to_s.strip.first(META_MAX).presence
    end

    def find_existing
      return unless idempotency_key

      form.responses.find_by(idempotency_key: idempotency_key)
    end
  end
end
