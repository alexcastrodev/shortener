class PushSubscription < ApplicationRecord
  MAX_PER_USER = 5
  HOSTS = [
    /\Afcm\.googleapis\.com\z/,
    /\Aupdates\.push\.services\.mozilla\.com\z/,
    /\A[a-z0-9-]+\.push\.services\.mozilla\.com\z/,
    /\Aweb\.push\.apple\.com\z/,
    /\A[a-z0-9-]+\.notify\.windows\.com\z/,
  ].freeze
  BASE64URL = /\A[A-Za-z0-9_-]+={0,2}\z/

  belongs_to :user

  validates :endpoint, presence: true, length: { maximum: 2048 }
  validates :p256dh, format: { with: BASE64URL }, length: { in: 80..100 }
  validates :auth, format: { with: BASE64URL }, length: { in: 20..30 }
  validate :endpoint_is_a_known_push_service
  validate :within_limit, on: :create

  private

  def endpoint_is_a_known_push_service
    uri = URI.parse(endpoint.to_s)
    known = uri.is_a?(URI::HTTPS) && uri.userinfo.nil? && uri.port == 443 && uri.fragment.nil? && HOSTS.any? { |pattern| pattern.match?(uri.host.to_s) }
    errors.add(:endpoint, :invalid) unless known
  rescue URI::InvalidURIError
    errors.add(:endpoint, :invalid)
  end

  def within_limit
    errors.add(:base, "limit_reached") if user && user.push_subscriptions.count >= MAX_PER_USER
  end
end
