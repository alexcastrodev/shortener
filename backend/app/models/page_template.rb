# == Schema Information
#
# Table name: page_templates
#
#  id         :bigint           not null, primary key
#  items      :jsonb            not null
#  name       :string           not null
#  theme      :string           default("default"), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  user_id    :bigint           not null
#
# Indexes
#
#  index_page_templates_on_user_id  (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id) ON DELETE => cascade
#
class PageTemplate < ApplicationRecord
  MAX_PER_USER = 20
  ITEM_KEYS = ["kind", "label", "url", "icon", "active"].freeze

  belongs_to :user

  validates :name, presence: true, length: { maximum: 60 }
  validates :theme, inclusion: { in: Page::THEMES }
  validate :items_shape
  validate :per_user_limit, on: :create

  # A snapshot of the page's items (in page order) and theme. URLs are kept:
  # the template is private to its owner.
  def self.from_page(page, name:)
    new(
      user: page.user,
      name: name,
      theme: page.theme,
      items: page.page_links.map { |link| link.slice(*ITEM_KEYS) },
    )
  end

  private

  def items_shape
    unless items.is_a?(Array) && items.size <= PageLink::MAX_PER_PAGE && items.all? { |item| item.is_a?(Hash) }
      errors.add(:items, "are invalid")
    end
  end

  def per_user_limit
    return if user.nil?

    errors.add(:base, "You can keep at most #{MAX_PER_USER} templates") if user.page_templates.count >= MAX_PER_USER
  end
end
