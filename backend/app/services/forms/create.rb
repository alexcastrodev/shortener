module Forms
  class LimitReached < StandardError; end

  class Create
    include Callable

    def initialize(user:, attributes: {})
      @user = user
      @attributes = attributes
    end

    def call
      user.with_lock do
        raise LimitReached if created_today >= Form::MAX_CREATED_PER_DAY

        user.forms.create!(attributes)
      end
    end

    private

    attr_reader :user, :attributes

    def created_today
      user.forms.where(created_at: 24.hours.ago..).count
    end
  end
end
