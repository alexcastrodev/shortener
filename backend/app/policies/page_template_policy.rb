class PageTemplatePolicy < ApplicationPolicy
  def moderate?
    user.admin?
  end
end
