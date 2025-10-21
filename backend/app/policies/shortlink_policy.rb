class ShortlinkPolicy < ApplicationPolicy
  def list_all?
    user.admin?
  end

  def modify_shortlink_safety?
    user.admin?
  end
end
