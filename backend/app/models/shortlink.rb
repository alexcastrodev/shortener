# == Schema Information
#
# Table name: shortlinks
#
#  id               :bigint           not null, primary key
#  events_count     :integer          default(0), not null
#  last_accessed_at :datetime
#  original_url     :string           not null
#  short_code       :string           not null
#  title            :string
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  user_id          :bigint
#
# Indexes
#
#  index_shortlinks_on_short_code  (short_code) UNIQUE
#  index_shortlinks_on_user_id     (user_id)
#
class Shortlink < ApplicationRecord
  # ===============
  # Scopes
  # ===============
  scope :without_user, -> { where(user_id: nil) }

  # ===============
  # Validations
  # ===============
  validates :original_url, presence: true
  validates :short_code, presence: true, uniqueness: true

  # ===============
  # Associations
  # ===============
  belongs_to :user, optional: true
  has_many :events, dependent: :destroy

  # ===============
  # Callbacks
  # ===============
  after_commit :save_cache, on: :create
  after_destroy :remove_cache, if: -> { short_code.present? }
  before_validation :generate_short_code, on: :create

  def event_statistics
    Events::StatisticsService.call(user: user)
  end

  def remove_cache
    Rails.cache.redis.with do |conn|
      conn.del(cache_key)
    end
  end

  def save_cache
    Rails.cache.redis.with do |conn|
      conn.set(cache_key, original_url)
    end
  end

  private

  def short_url
    "#{ENV["EDGE_API"]}/#{short_code}"
  end

  def cache_key
    "shortlink:#{short_code}"
  end

  def generate_short_code
    self.short_code ||= loop do
      code = SecureRandom.alphanumeric(6)
      break code unless Shortlink.exists?(short_code: code)
    end
  end
end
