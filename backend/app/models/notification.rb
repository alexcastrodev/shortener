class Notification < ApplicationRecord
  RETENTION = 90.days

  belongs_to :user, optional: true
  belongs_to :appointment, optional: true

  scope :in_app, -> { where(channel: "in_app") }
  scope :unread, -> { where(read_at: nil) }

  def self.notify_owner(user_id:, kind:, event_key:, source:, payload:)
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
