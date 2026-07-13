# frozen_string_literal: true

module Admin
  class AuditSearchService
    include Callable

    def initialize(user_id: nil)
      @user_id = user_id
    end

    def call
      scope = Audited::Audit.all.order(created_at: :desc)
      scope = apply_user_filter(scope)
      scope
    end

    private

    def apply_user_filter(scope)
      return scope if @user_id.blank?

      scope.where(user_id: @user_id, user_type: "User")
    end
  end
end
