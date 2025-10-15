class UserPolicy < ApplicationPolicy
  def list_all?
    user.admin?
  end
end
