# frozen_string_literal: true

module Admin
  class UserSearchService
    include Callable

    def initialize(status: nil, q: nil)
      @status = status
      @q = q
    end

    def call
      scope = User.all.order(id: :desc)
      scope = apply_status(scope)
      scope = apply_search(scope)
      scope
    end

    private

    def apply_status(scope)
      case @status
      when "active" then scope.where(deactivated_at: nil)
      when "inactive" then scope.where.not(deactivated_at: nil)
      else scope
      end
    end

    def apply_search(scope)
      return scope if @q.blank?

      scope.search_by_term(@q)
    end
  end
end
