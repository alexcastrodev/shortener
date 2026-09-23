class CreateIdentities < ActiveRecord::Migration[8.1]
  # External sign-in accounts (Google, for now) linked to a Kurz user. `uid`
  # is the provider's stable id (Google's "sub"); the email can change on the
  # provider side, so it is kept only as information.
  def change
    create_table(:identities) do |t|
      t.references(:user, null: false, foreign_key: { on_delete: :cascade })
      t.string(:provider, null: false)
      t.string(:uid, null: false)
      t.string(:email)
      t.datetime(:last_used_at)
      t.timestamps
    end
    add_index(:identities, [:provider, :uid], unique: true)
    add_index(:identities, [:user_id, :provider], unique: true)
  end
end
