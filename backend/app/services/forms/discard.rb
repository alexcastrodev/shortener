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
        form.update!(Snapshot.stored(form).slice(*Snapshot::KEYS))
      end
      Covers.prune(form)
      form
    end

    private

    attr_reader :form
  end
end
