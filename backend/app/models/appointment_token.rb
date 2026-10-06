class AppointmentToken < ApplicationRecord
  PURPOSES = ["manage"].freeze

  belongs_to :appointment

  def self.issue(appointment:, expires_at:, purpose: "manage")
    raw = SecureRandom.urlsafe_base64(32)
    create!(appointment: appointment, purpose: purpose, digest: digest(raw), expires_at: expires_at, created_at: Time.current)
    raw
  end

  def self.resolve(raw, purpose: "manage")
    return if raw.blank?

    row = find_by(digest: digest(raw), purpose: purpose)
    row&.appointment if row && row.expires_at > Time.current
  end

  def self.digest(raw) = OpenSSL::Digest::SHA256.hexdigest(raw.to_s)
end
