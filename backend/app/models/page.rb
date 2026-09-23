# == Schema Information
#
# Table name: pages
#
#  id            :bigint           not null, primary key
#  bio           :text
#  deleted_at    :datetime
#  display_title :string
#  expires_at    :datetime
#  published     :boolean          default(TRUE), not null
#  slug          :string           not null
#  theme         :string           default("default"), not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  user_id       :bigint           not null
#
# Indexes
#
#  index_pages_on_deleted_at  (deleted_at)
#  index_pages_on_slug        (slug) UNIQUE
#  index_pages_on_user_id     (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#
class Page < ApplicationRecord
  THEMES = ["default", "midnight", "sunset", "forest", "ocean", "paper"].freeze
  # Phone photos (HEIC or JPEG) are often 2-5MB; only a small WebP variant
  # is ever served.
  AVATAR_MAX_SIZE = 10.megabytes
  SLUG_FORMAT = /\A[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]\z/
  # Slugs that would be confusing as /u/:slug or collide with product words.
  RESERVED_SLUGS = [
    "about", "admin", "api", "app", "dashboard", "help", "kurz", "login", "logout",
    "me", "new", "pages", "report", "settings", "signup", "status", "support", "u", "www",
  ].freeze

  # ===============
  # Audit
  # ===============
  audited except: [:deleted_at]

  # ===============
  # Scopes
  # ===============
  default_scope { where(deleted_at: nil) }
  scope :with_deleted, -> { unscope(where: :deleted_at) }
  scope :visible, -> {
    where(published: true)
      .where("pages.expires_at IS NULL OR pages.expires_at > ?", Time.current)
      .joins(:user).merge(User.active)
  }

  # ===============
  # Validations
  # ===============
  normalizes :slug, with: ->(slug) { slug.strip.downcase }
  validates :slug, presence: true, format: { with: SLUG_FORMAT }, exclusion: { in: RESERVED_SLUGS }
  validate :slug_not_taken
  validates :theme, inclusion: { in: THEMES }
  validates :display_title, length: { maximum: 80 }
  validates :bio, length: { maximum: 300 }

  # ===============
  # Associations
  # ===============
  belongs_to :user
  has_many :page_links, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :page
  has_one_attached :avatar do |attachable|
    attachable.variant(:thumb, resize_to_fill: [400, 400], format: :webp)
  end

  def soft_delete!
    update!(deleted_at: Time.current)
  end

  def public_url
    "#{ENV["FRONTEND_URL"]}/u/#{slug}"
  end

  # Always the resized variant, never the original upload: visitors only
  # ever get a file that went through the image pipeline. Served through
  # Rails (proxy mode) rather than redirecting to the bucket, so the
  # SeaweedFS gateway never has to be reachable from the internet, the URL
  # never expires, and the response is cacheable by the CDN.
  def avatar_url
    return unless avatar.attached?

    Rails.application.routes.url_helpers.rails_storage_proxy_url(
      avatar.variant(:thumb),
      **ActiveStorage::Current.url_options.to_h,
    )
  end

  private

  # The unique index covers soft-deleted rows too, so check against them as
  # well to return a validation error instead of a database exception.
  def slug_not_taken
    return if slug.blank?

    taken = Page.with_deleted.where(slug: slug).where.not(id: id).exists?
    errors.add(:slug, :taken) if taken
  end
end
