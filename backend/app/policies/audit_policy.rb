class AuditPolicy < ApplicationPolicy
  def list_all?
    user.admin?
  end
end
