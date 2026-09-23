class AbuseSignalPolicy < ApplicationPolicy
  def moderate?
    user.admin?
  end
end
