# == Schema Information
#
# Table name: page_links
#
#  id              :bigint           not null, primary key
#  active          :boolean          default(TRUE), not null
#  clicks_count    :integer          default(0), not null
#  icon            :string
#  kind            :string           default("link"), not null
#  label           :string           not null
#  position        :integer          default(0), not null
#  safe            :boolean          default(TRUE), not null
#  safe_checked_at :datetime
#  url             :string
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  page_id         :bigint           not null
#
# Indexes
#
#  index_page_links_on_page_id_and_position  (page_id,position)
#
# Foreign Keys
#
#  fk_rails_...  (page_id => pages.id) ON DELETE => cascade
#
class PageLink < ApplicationRecord
  MAX_PER_PAGE = 50
  KINDS = ["link", "social", "header"].freeze
  # Brand icons the frontend knows how to draw (bio-page/social-networks),
  # with the display name and the placeholder URL used by templates.
  NETWORKS = {
    "instagram" => { name: "Instagram", placeholder: "https://www.instagram.com/your_handle" },
    "tiktok" => { name: "TikTok", placeholder: "https://www.tiktok.com/@your_handle" },
    "facebook" => { name: "Facebook", placeholder: "https://www.facebook.com/your_page" },
    "linkedin" => { name: "LinkedIn", placeholder: "https://www.linkedin.com/in/your_profile" },
    "snapchat" => { name: "Snapchat", placeholder: "https://www.snapchat.com/add/your_handle" },
    "youtube" => { name: "YouTube", placeholder: "https://www.youtube.com/@your_channel" },
    "x" => { name: "X", placeholder: "https://x.com/your_handle" },
    "onlyfans" => { name: "OnlyFans", placeholder: "https://onlyfans.com/your_handle" },
    "whatsapp" => { name: "WhatsApp", placeholder: "https://wa.me/351900000000" },
  }.freeze
  ICONS = NETWORKS.keys.freeze

  # ===============
  # Audit
  # ===============
  audited except: [:clicks_count, :position], associated_with: :page

  # ===============
  # Scopes
  # ===============
  scope :active, -> { where(active: true) }
  scope :safe, -> { where(safe: true) }
  # What visitors of the public page see.
  scope :visible, -> { active.safe }
  scope :clickable, -> { where.not(kind: "header") }

  # ===============
  # Validations
  # ===============
  validates :kind, inclusion: { in: KINDS }
  validates :label, presence: true, length: { maximum: 80 }
  validates :url, presence: true, length: { maximum: 2048 }, unless: :header?
  validates :url, absence: true, if: :header?
  validates :icon, inclusion: { in: ICONS }, allow_nil: true
  validates :icon, presence: true, if: :social?
  validate :header_kind_is_fixed, on: :update
  validate :page_link_limit, on: :create

  # ===============
  # Associations
  # ===============
  belongs_to :page
  has_many :page_link_clicks, dependent: :delete_all

  # ===============
  # Callbacks
  # ===============
  before_validation :set_position, on: :create
  # Bio links are checked on every URL change, not only on creation, and
  # again periodically (RecheckPageLinksSafetyJob): a link approved once can
  # later be swapped for something malicious.
  after_commit :verify_safety, on: [:create, :update], if: -> { saved_change_to_url? && url.present? }

  def header?
    kind == "header"
  end

  def social?
    kind == "social"
  end

  private

  # Links and social icons can switch between each other; a section header
  # has no URL, so it cannot become one (and vice versa).
  def header_kind_is_fixed
    return unless will_save_change_to_kind? || saved_change_to_kind?
    return unless kind_was == "header" || kind == "header"

    errors.add(:kind, "cannot change to or from a header")
  end

  def verify_safety
    PageLinkSafetyJob.perform_later([id]) if ENV["ENABLE_GOOGLE_SAFE_LINK"].present?
  end

  def set_position
    return if page.nil? || position.to_i.positive?

    self.position = page.page_links.maximum(:position).to_i + 1
  end

  def page_link_limit
    return if page.nil?

    errors.add(:base, "A page can have at most #{MAX_PER_PAGE} links") if page.page_links.count >= MAX_PER_PAGE
  end
end
