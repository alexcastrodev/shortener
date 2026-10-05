class CreateNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table(:notifications) do |t|
      t.string(:channel, null: false)
      t.string(:kind, null: false)
      t.string(:recipient_kind, null: false)
      t.references(:user, foreign_key: { on_delete: :cascade })
      t.string(:recipient_email)
      t.references(:appointment, foreign_key: { on_delete: :cascade })
      t.string(:event_key, null: false)
      t.jsonb(:payload, default: {}, null: false)
      t.string(:status, default: "pending", null: false)
      t.integer(:attempts, default: 0, null: false)
      t.datetime(:next_attempt_at)
      t.datetime(:sent_at)
      t.datetime(:read_at)
      t.text(:last_error)
      t.datetime(:created_at, null: false)
      t.index([:user_id, :channel, :id], name: "index_notifications_on_user_channel_id")
      t.index([:status, :next_attempt_at], where: "status = 'pending'", name: "index_notifications_pending")
      t.index([:created_at])
      t.index("kind, event_key, channel, recipient_kind, COALESCE((user_id)::text, (recipient_email)::text)", unique: true, name: "index_notifications_uniqueness")
      t.check_constraint("channel IN ('in_app', 'email', 'push')", name: "notifications_channel_known")
      t.check_constraint("recipient_kind IN ('owner', 'client')", name: "notifications_recipient_kind_known")
      t.check_constraint("status IN ('pending', 'sent', 'failed')", name: "notifications_status_known")
      t.check_constraint("(recipient_kind = 'owner' AND user_id IS NOT NULL) OR (recipient_kind = 'client' AND recipient_email IS NOT NULL)", name: "notifications_has_recipient")
      t.check_constraint("jsonb_typeof(payload) = 'object'", name: "notifications_payload_is_object")
    end
  end
end
