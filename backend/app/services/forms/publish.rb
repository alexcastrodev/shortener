module Forms
  class Publish
    include Callable

    class NoQuestions < StandardError; end

    class Blocked < StandardError
      attr_reader :messages

      def initialize(messages)
        @messages = messages
        super(messages.to_sentence)
      end
    end

    DIGEST_SQL = "published_digest = encode(sha256(convert_to(published_snapshot::text, 'UTF8')), 'hex')".freeze

    def initialize(form:)
      @form = form
    end

    def call
      raise NoQuestions if form.fields.none? { |field| FieldSchema.answerable?(field) }

      blocks = BookingSchema.publish_blocks(form.fields)
      raise Blocked, blocks if blocks.any?

      form.ensure_shortlink!
      form.with_lock do
        form.update!(published: true, published_snapshot: Snapshot.of(form), published_version: form.published_version + 1)
        Form.where(id: form.id).update_all(DIGEST_SQL)
      end
      Covers.prune(form)
      form.reload
    end

    private

    attr_reader :form
  end
end
