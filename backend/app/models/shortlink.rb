# == Schema Information
#
# Table name: shortlinks
#
#  id               :bigint           not null, primary key
#  deleted_at       :datetime
#  events_count     :integer          default(0), not null
#  expires_at       :datetime
#  inactive_at      :datetime
#  last_accessed_at :datetime
#  original_url     :string           not null
#  password_digest  :string
#  safe             :boolean          default(TRUE), not null
#  safe_checked_at  :datetime
#  short_code       :string           not null
#  title            :string
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  user_id          :bigint           not null
#
# Indexes
#
#  index_shortlinks_on_deleted_at  (deleted_at)
#  index_shortlinks_on_expires_at  (expires_at) WHERE ((expires_at IS NOT NULL) AND (inactive_at IS NULL))
#  index_shortlinks_on_short_code  (short_code) UNIQUE
#  index_shortlinks_on_user_id     (user_id)
#
class Shortlink < ApplicationRecord
  include PgSearch::Model

  # ===============
  # Audit
  # ===============
  audited except: [:short_code, :events_count, :last_accessed_at, :deleted_at, :password_digest]

  # ===============
  # Search
  # ===============
  pg_search_scope :search_by_term,
    against: [:title, :original_url, :short_code],
    associated_against: { user: :email },
    using: { tsearch: { prefix: true } }

  # ===============
  # Scopes
  # ===============
  default_scope { where(deleted_at: nil) }
  scope :with_deleted, -> { unscope(where: :deleted_at) }
  scope :safe, -> { where(safe: true) }
  scope :active, -> { where(inactive_at: nil) }
  scope :expired, -> { where(inactive_at: nil).where(expires_at: ..Time.current) }

  # ===============
  # Validations
  # ===============
  validates :original_url, presence: true
  validates :short_code, presence: true, uniqueness: true

  # Optional: without a password the link redirects straight from the edge.
  has_secure_password validations: false
  validates :password, length: { in: 4..72 }, allow_nil: true

  # ===============
  # Associations
  # ===============
  belongs_to :user
  counter_culture :user
  has_many :events

  # ===============
  # Callbacks
  # ===============
  after_commit :save_cache, :verify_safety, on: :create
  after_destroy :remove_cache, if: -> { short_code.present? }
  before_validation :generate_short_code, on: :create

  def event_statistics
    Events::StatisticsService.call(user: user, shortlink: self)
  end

  def remove_cache
    Rails.cache.redis.with do |conn|
      conn.del(cache_key)
    end
  rescue => e
    Rails.logger.error("Failed to remove shortlink cache: #{e.class}: #{e.message}")
    false
  end

  # The edge function reads this value on every redirect. It is a small JSON
  # document rather than the raw URL so new link states only add a new "t",
  # instead of magic strings mixed with URLs:
  #   {"t":"url","v":"https://..."} redirect to v
  #   {"t":"locked"}                redirect to the password page (/s/:code)
  def save_cache
    Rails.cache.redis.with do |conn|
      conn.set(cache_key, cache_value.to_json)
    end
  rescue => e
    Rails.logger.error("Failed to save shortlink cache: #{e.class}: #{e.message}")
    false
  end

  # Marks the link as deleted and returns immediately. The actual removal of
  # the link and its (potentially thousands of) events happens in the
  # background via PurgeShortlinkJob.
  def soft_delete!
    remove_cache
    update!(deleted_at: Time.current)
    PurgeShortlinkJob.perform_later(id)
  end

  def mark_as_dangerous!
    remove_cache
    update!(safe: false, safe_checked_at: Time.current, inactive_at: Time.current)
  end

  # A link past its expiration date stays inactive even when it is safe.
  def mark_as_safe!
    update!(safe: true, safe_checked_at: Time.current, inactive_at: expired? ? (inactive_at || Time.current) : nil)
    save_cache if servable?
  end

  def cache_key
    "shortlink:#{short_code}"
  end

  def cache_value
    password_protected? ? { t: "locked" } : { t: "url", v: original_url }
  end

  def password_protected?
    password_digest.present?
  end

  def expired?
    expires_at.present? && expires_at <= Time.current
  end

  # Hard deadline: the cache entry goes away with the flag, so the edge
  # stops redirecting at the moment the link expires.
  def expire!
    remove_cache
    update!(inactive_at: Time.current)
  end

  # Whether the edge should redirect for this link at all.
  def servable?
    inactive_at.nil? && safe? && !expired?
  end

  def short_url
    "#{ENV["EDGE_API"]}/#{short_code}"
  end

  private

  # ============
  # Callbacks
  # ============
  def verify_safety
    SafetyUrlJob.perform_later(id) if ENV["ENABLE_GOOGLE_SAFE_LINK"].present?
  end

  def generate_short_code
    self.short_code ||= loop do
      code = SecureRandom.alphanumeric(6)
      break code unless Shortlink.with_deleted.exists?(short_code: code)
    end
  end
end
