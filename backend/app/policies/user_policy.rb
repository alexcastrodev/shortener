class UserPolicy < ApplicationPolicy
  def list_all?
    user.admin?
  end

  def toggle_active?
    user.admin? && user != record
  end
end
