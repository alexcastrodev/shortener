module Forms
  class Publish
    include Callable

    class NoQuestions < StandardError; end

    class Blocked < StandardError
      attr_reader :blocks

      def initialize(blocks)
        @blocks = blocks
        super(messages.to_sentence)
      end

      def messages
        blocks.pluck(:message)
      end

      def codes
        blocks.map { |block| block.slice(:code, :name) }
      end
    end

    DIGEST_SQL = "published_digest = encode(sha256(convert_to(published_snapshot::text, 'UTF8')), 'hex')".freeze

    def self.questions?(form)
      form.fields.any? { |field| FieldSchema.answerable?(field) }
    end

    def self.blocks(form)
      return [{ code: "no_questions" }] unless questions?(form)

      BookingSchema.publish_blocks(form.fields)
    end

    def initialize(form:)
      @form = form
    end

    def call
      raise NoQuestions unless self.class.questions?(form)

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
