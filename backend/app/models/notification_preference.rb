class NotificationPreference < ApplicationRecord
  CHANNELS = ["in_app", "email", "push"].freeze
  SUPPORTED = {
    "appointment_created" => ["in_app", "email", "push"],
    "appointment_requested" => ["in_app", "email", "push"],
    "appointment_cancelled" => ["in_app", "push"],
    "appointment_expired" => ["in_app", "push"],
    "appointment_auto_confirmed" => ["in_app", "push"],
  }.freeze
  KINDS = SUPPORTED.keys.freeze

  belongs_to :user

  validates :kind, inclusion: { in: KINDS }
  validates :channel, inclusion: { in: CHANNELS }
  validate :channel_is_supported

  def self.enabled?(user_id:, kind:, channel:)
    where(user_id: user_id, kind: kind, channel: channel).pick(:enabled) != false
  end

  def self.matrix(user)
    stored = where(user_id: user.id).pluck(:kind, :channel, :enabled).to_h { |kind, channel, enabled| [[kind, channel], enabled] }
    KINDS.flat_map do |kind|
      CHANNELS.map do |channel|
        supported = SUPPORTED[kind].include?(channel)
        { kind: kind, channel: channel, supported: supported, enabled: supported && stored.fetch([kind, channel], true) }
      end
    end
  end

  private

  def channel_is_supported
    errors.add(:channel, :invalid) unless SUPPORTED.fetch(kind, []).include?(channel)
  end
end
