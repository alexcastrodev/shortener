class Notification < ApplicationRecord
  RETENTION = 90.days

  belongs_to :user, optional: true
  belongs_to :appointment, optional: true

  scope :in_app, -> { where(channel: "in_app") }
  scope :unread, -> { where(read_at: nil) }

  def self.queue_email(kind:, event_key:, source:, recipient_kind:, payload:, user_id: nil, recipient_email: nil)
    return if recipient_kind == "owner" && !NotificationPreference.enabled?(user_id: user_id, kind: kind, channel: "email")

    row = create!(
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
    mirror_to_client(kind, event_key, source, payload, recipient_email) if recipient_kind == "client" && kind != "appointment_verify"
    row
  end

  def self.mirror_to_client(kind, event_key, source, payload, email)
    user = client_account(email)
    return unless user

    create!(
      channel: "in_app",
      kind: kind,
      recipient_kind: "client",
      user_id: user.id,
      recipient_email: email,
      event_key: event_key,
      appointment: source,
      payload: payload.to_h.with_indifferent_access.slice(:group_key, :sessions),
      status: "sent",
      sent_at: Time.current,
    )
  end

  def self.client_account(email)
    User.active.where.not(verified_at: nil).find_by("lower(email) = ?", email.to_s.downcase)
  end

  def self.bell(user)
    in_app.where(user_id: user.id, recipient_kind: ["owner", "client"])
  end

  def self.present(rows, user)
    ids = rows.filter_map { |row| row.payload["waitlist_entry_id"] }
    entries = ids.empty? ? {} : WaitlistEntry.active.where(id: ids).where("lower(email) = ?", user.email.downcase).index_by(&:id)
    rows.map do |row|
      entry = entries[row.payload["waitlist_entry_id"]]
      item = { id: row.id, kind: row.kind, recipient_kind: row.recipient_kind, payload: row.payload.except("waitlist_entry_id"), read_at: row.read_at&.iso8601, created_at: row.created_at.iso8601 }
      entry ? item.merge(waitlist_path: "/w/#{entry.token}") : item
    end
  end

  def self.notify_owner(user_id:, kind:, event_key:, source:, payload:)
    row = create_in_app(user_id, kind, event_key, source, payload)
    queue_push(user_id, kind, event_key, source, payload)
    row
  end

  def self.create_in_app(user_id, kind, event_key, source, payload)
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

  def self.queue_push(user_id, kind, event_key, source, payload)
    return unless Push::Config.enabled? && PushSubscription.exists?(user_id: user_id)
    return unless NotificationPreference.enabled?(user_id: user_id, kind: kind, channel: "push")

    row = create!(
      channel: "push",
      kind: kind,
      recipient_kind: "owner",
      user_id: user_id,
      event_key: event_key,
      appointment: source,
      payload: payload.slice(:form_id, :response_id, :group_key),
      status: "pending",
      next_attempt_at: Time.current,
    )
    ActiveRecord.after_all_transactions_commit { PushDeliveryJob.perform_later(row.id) }
    row
  end
end
