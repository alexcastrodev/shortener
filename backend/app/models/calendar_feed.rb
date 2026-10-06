class CalendarFeed < ApplicationRecord
  belongs_to :user

  def self.issue(user)
    raw = SecureRandom.urlsafe_base64(32)
    transaction do
      where(user_id: user.id).delete_all
      create!(user: user, digest: digest(raw), created_at: Time.current)
    end
    raw
  end

  def self.resolve(raw)
    find_by(digest: digest(raw)) if raw.to_s.match?(/\A[A-Za-z0-9_-]{43}\z/)
  end

  def self.digest(raw) = OpenSSL::Digest::SHA256.hexdigest(raw.to_s)
end
