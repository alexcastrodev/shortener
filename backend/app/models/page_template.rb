# == Schema Information
#
# Table name: page_templates
#
#  id             :bigint           not null, primary key
#  author_label   :string
#  description    :string
#  hidden_at      :datetime
#  items          :jsonb            not null
#  name           :string           not null
#  published_at   :datetime
#  reports_count  :integer          default(0), not null
#  theme          :string           default("default"), not null
#  uses_count     :integer          default(0), not null
#  visibility     :string           default("private"), not null
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  author_page_id :bigint
#  user_id        :bigint           not null
#
# Indexes
#
#  idx_on_visibility_hidden_at_uses_count_757c1d2d8f  (visibility,hidden_at,uses_count)
#  index_page_templates_on_author_page_id             (author_page_id)
#  index_page_templates_on_user_id                    (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (author_page_id => pages.id) ON DELETE => nullify
#  fk_rails_...  (user_id => users.id) ON DELETE => cascade
#
class PageTemplate < ApplicationRecord
  MAX_PER_USER = 20
  ITEM_KEYS = ["kind", "label", "url", "icon", "active"].freeze
  VISIBILITIES = ["private", "public"].freeze
  AUTO_HIDE_AFTER_REPORTS = 3
  # Public text must not smuggle links into the Community gallery (the
  # items themselves are always placeholders there).
  URL_LIKE = %r{https?://|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|ly|me|co|br|pt|link|xyz|app|site|gg|to|tv)\b}i

  belongs_to :user
  belongs_to :author_page, class_name: "Page", optional: true
  has_many :reports, class_name: "PageTemplateReport", dependent: :delete_all

  validates :name, presence: true, length: { maximum: 60 }
  validates :description, length: { maximum: 140 }
  validates :theme, inclusion: { in: Page::THEMES }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validate :items_shape
  validate :per_user_limit, on: :create
  validate :public_text_without_links, if: :public?

  # What the Community gallery lists: public and not hidden by moderation.
  scope :listed, -> { where(visibility: "public", hidden_at: nil) }

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

  # "Marina Costa · @marina", or just "@marina" for a page without a title.
  def self.author_label_for(page)
    [page.display_title.presence, "@#{page.slug}"].compact.join(" · ")
  end

  def public?
    visibility == "public"
  end

  def publish!(author_page:, description:)
    update!(
      visibility: "public",
      description: description.presence,
      author_page: author_page,
      author_label: self.class.author_label_for(author_page),
      published_at: Time.current,
    )
  end

  def unpublish!
    update!(visibility: "private")
  end

  # The version everyone else gets: same layout and theme, but none of the
  # author's texts or links. Derived on every read so the originals never
  # leave the server in a public response.
  def public_items
    counters = Hash.new(0)
    items.map do |item|
      kind = item["kind"]
      network = PageLink::NETWORKS[item["icon"]]
      case kind
      when "social"
        next unless network

        { "kind" => "social", "label" => network[:name], "url" => network[:placeholder], "icon" => item["icon"], "active" => false }
      when "header"
        { "kind" => "header", "label" => "Section #{counters["header"] += 1}", "url" => nil, "icon" => nil, "active" => true }
      else
        label = network ? "#{network[:name]} link" : "Link #{counters["link"] += 1}"
        { "kind" => "link", "label" => label, "url" => BuiltInPageTemplates::PLACEHOLDER, "icon" => network && item["icon"], "active" => false }
      end
    end.compact
  end

  # One report per user; enough distinct reports take the template out of
  # the gallery until an admin looks at it.
  def report!(user:, reason:)
    transaction do
      reports.create!(user: user, reason: reason)
      increment!(:reports_count)
      update!(hidden_at: Time.current) if reports_count >= AUTO_HIDE_AFTER_REPORTS && hidden_at.nil?
    end
  end

  def toggle_hidden!
    if hidden_at
      update!(hidden_at: nil, reports_count: 0)
      reports.delete_all
    else
      update!(hidden_at: Time.current)
    end
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

  def public_text_without_links
    errors.add(:name, "cannot contain links in a public template") if name.to_s.match?(URL_LIKE)
    errors.add(:description, "cannot contain links") if description.to_s.match?(URL_LIKE)
  end
end
