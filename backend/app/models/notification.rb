class Notification < ApplicationRecord
  RETENTION = 90.days

  belongs_to :user, optional: true
  belongs_to :appointment, optional: true

  scope :in_app, -> { where(channel: "in_app") }
  scope :unread, -> { where(read_at: nil) }

  def self.queue_email(kind:, event_key:, source:, recipient_kind:, payload:, user_id: nil, recipient_email: nil)
    return if recipient_kind == "owner" && !NotificationPreference.enabled?(user_id: user_id, kind: kind, channel: "email")

    create!(
      channel: "email",
      kind: kind,
      recipient_kind: recipient_kind,
      user_id: user_id,
      recipient_email: recipient_email,
      event_key: event_key,
      appointment: source,
      payload: payload,
      status: "pending",
      next_attempt_at: Time.current,
    )
  end

  def self.notify_owner(user_id:, kind:, event_key:, source:, payload:)
    return unless NotificationPreference.enabled?(user_id: user_id, kind: kind, channel: "in_app")

    create!(
      channel: "in_app",
      kind: kind,
      recipient_kind: "owner",
      user_id: user_id,
      event_key: event_key,
      appointment: source,
      payload: payload,
      status: "sent",
      sent_at: Time.current,
    )
  end
end
