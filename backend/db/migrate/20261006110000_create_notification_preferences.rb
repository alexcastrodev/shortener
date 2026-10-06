class CreateNotificationPreferences < ActiveRecord::Migration[8.1]
  def change
    create_table(:notification_preferences) do |t|
      t.references(:user, null: false, foreign_key: { on_delete: :cascade })
      t.string(:kind, null: false)
      t.string(:channel, null: false)
      t.boolean(:enabled, null: false)
      t.timestamps
      t.index([:user_id, :kind, :channel], unique: true, name: "index_notification_preferences_uniqueness")
      t.check_constraint("channel IN ('in_app', 'email', 'push')", name: "notification_preferences_channel_known")
    end
  end
end
