class FormPolicy < ApplicationPolicy
  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(user: user)
    end
  end
end
