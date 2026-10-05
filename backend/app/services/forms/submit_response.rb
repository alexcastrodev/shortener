module Forms
  class SubmitResponse
    include Callable

    Result = Data.define(:response, :errors, :created)

    META_MAX = 40

    class ClaimFailed < StandardError; end

    def initialize(form:, answers:, idempotency_key: nil, meta: {})
      @form = form
      @answers = answers
      @idempotency_key = idempotency_key.presence&.to_s&.first(64)
      @meta = meta
    end

    def call
      existing = find_existing
      return Result.new(existing, nil, false) if existing

      return Result.new(nil, { "answers" => ["invalid"] }, false) unless answers.is_a?(Hash)

      @claims = []
      values, errors = cast_all
      return Result.new(nil, errors, false) if errors.any?

      create(values)
    end

    private

    attr_reader :form, :answers, :idempotency_key, :meta

    def cast_all
      values = {}
      errors = {}
      form.fields.select { |field| FieldSchema.answerable?(field) }.each do |field|
        value, error = field["type"] == "image" ? cast_image(field, answers[field["id"]]) : FieldSchema.cast_answer(field, answers[field["id"]])
        if error
          errors[field["id"]] = [error.to_s]
        elsif !value.nil?
          values[field["id"]] = value
        end
      end
      [values, errors]
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

        Result.new(response, nil, true)
      end
    rescue ClaimFailed
      Result.new(nil, { "answers" => ["invalid"] }, false)
    rescue ActiveRecord::RecordNotUnique
      existing = find_existing
      raise unless existing

      Result.new(existing, nil, false)
    end

    def attributes
      {
        idempotency_key: idempotency_key,
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
