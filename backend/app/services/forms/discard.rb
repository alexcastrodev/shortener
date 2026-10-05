module Forms
  class Discard
    include Callable

    class NothingPublished < StandardError; end

    def initialize(form:)
      @form = form
    end

    def call
      raise NothingPublished if form.published_snapshot.blank?

      form.with_lock do
        form.update!(form.published_snapshot.slice(*Snapshot::KEYS))
      end
      form
    end

    private

    attr_reader :form
  end
end
