class OauthGrant < ApplicationRecord
  SCOPES = ["forms:read", "forms:write", "responses:read", "shortlinks:read", "shortlinks:write", "pages:read", "pages:write"].freeze

  audited only: [:scopes, :revoked_at]

  belongs_to :user
  belongs_to :oauth_client
  has_many :authorization_codes, class_name: "OauthAuthorizationCode", dependent: :delete_all
  has_many :access_tokens, class_name: "OauthAccessToken", dependent: :delete_all
  has_many :refresh_tokens, class_name: "OauthRefreshToken", dependent: :delete_all

  scope :active, -> { where(revoked_at: nil) }

  validates :resource, presence: true
  validate :scopes_known

  def active?
    revoked_at.nil?
  end

  def revoke!
    return if revoked_at

    update!(revoked_at: Time.current)
    access_tokens.delete_all
    refresh_tokens.delete_all
  end

  private

  def scopes_known
    errors.add(:scopes, :invalid) unless scopes.is_a?(Array) && scopes.any? && (scopes - SCOPES).empty? && scopes.uniq.size == scopes.size
  end
end
