class CreatePushSubscriptions < ActiveRecord::Migration[8.1]
  def change
    create_table(:push_subscriptions) do |t|
      t.references(:user, null: false, foreign_key: { on_delete: :cascade })
      t.string(:endpoint, limit: 2048, null: false)
      t.string(:p256dh, null: false)
      t.string(:auth, null: false)
      t.string(:user_agent_label)
      t.datetime(:last_used_at)
      t.timestamps
      t.index([:endpoint], unique: true)
    end
  end
end
