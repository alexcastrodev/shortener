# Ownership of pages is enforced here (via Scope) rather than by scoping
# through current_user in each controller, so every page lookup goes through
# the same rule.
class PagePolicy < ApplicationPolicy
  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(user: user)
    end
  end
end
