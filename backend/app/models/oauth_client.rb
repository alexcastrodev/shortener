class OauthClient < ApplicationRecord
  MAX_REDIRECT_URIS = 5
  MAX_PAYLOAD_BYTES = 5.kilobytes

  has_many :grants, class_name: "OauthGrant", dependent: :destroy

  before_validation(on: :create) { self.client_id ||= SecureRandom.urlsafe_base64(24) }

  validates :client_name, presence: true, length: { maximum: 100 }
  validate :redirect_uris_allowed

  def redirect_uri?(requested)
    redirect_uris.any? { |registered| Oauth::RedirectUri.match?(registered, requested) }
  end

  private

  def redirect_uris_allowed
    list = redirect_uris
    return errors.add(:redirect_uris, :invalid) unless list.is_a?(Array) && list.size.between?(1, MAX_REDIRECT_URIS)

    errors.add(:redirect_uris, :invalid) unless list.all? { |uri| Oauth::RedirectUri.valid?(uri) }
  end
end
