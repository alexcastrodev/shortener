# == Schema Information
#
# Table name: page_template_reports
#
#  id               :bigint           not null, primary key
#  reason           :string           not null
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  page_template_id :bigint           not null
#  user_id          :bigint           not null
#
# Indexes
#
#  index_page_template_reports_on_page_template_id              (page_template_id)
#  index_page_template_reports_on_page_template_id_and_user_id  (page_template_id,user_id) UNIQUE
#  index_page_template_reports_on_user_id                       (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (page_template_id => page_templates.id) ON DELETE => cascade
#  fk_rails_...  (user_id => users.id) ON DELETE => cascade
#
class PageTemplateReport < ApplicationRecord
  REASONS = ["spam", "offensive", "impersonation", "other"].freeze

  belongs_to :page_template
  belongs_to :user

  validates :reason, inclusion: { in: REASONS }
  validates :user_id, uniqueness: { scope: :page_template_id, message: "already reported this template" }
  validate :not_own_template

  private

  def not_own_template
    errors.add(:base, "You cannot report your own template") if page_template && page_template.user_id == user_id
  end
end
