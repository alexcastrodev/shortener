module Forms
  class Unpublish
    include Callable

    def initialize(form:)
      @form = form
    end

    def call
      form.update!(published: false)
      form
    end

    private

    attr_reader :form
  end
end
