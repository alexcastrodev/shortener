class WaitlistEntry < ApplicationRecord
  STATUSES = ["waiting", "offered", "claimed", "expired", "left"].freeze
  ACTIVE = ["waiting", "offered"].freeze
  PURPOSE = :waitlist

  belongs_to :form

  scope :active, -> { where(status: ACTIVE) }

  def token
    signed_id(purpose: PURPOSE, expires_at: starts_at + 1.day)
  end

  def self.from_token(raw)
    find_signed(raw.to_s, purpose: PURPOSE) if raw.to_s.length.between?(20, 400)
  end

  def active? = ACTIVE.include?(status)
end
