class AppointmentToken < ApplicationRecord
  PURPOSES = ["manage"].freeze

  belongs_to :appointment

  def self.issue(appointment:, expires_at:, purpose: "manage")
    token = SecureRandom.urlsafe_base64(32)
    create!(appointment: appointment, purpose: purpose, digest: digest(token), expires_at: expires_at, created_at: Time.current)
    token
  end

  def self.resolve(token, purpose: "manage")
    return if token.blank?

    row = find_by(digest: digest(token), purpose: purpose)
    row&.appointment if row && row.expires_at > Time.current
  end

  def self.digest(token) = OpenSSL::Digest::SHA256.hexdigest(token.to_s)
end
