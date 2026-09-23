class AddPasswordToUsers < ActiveRecord::Migration[8.1]
  def change
    change_table(:users, bulk: true) do |t|
      # Argon2id hash; nil for accounts that only sign in with an email code.
      t.string(:password_digest)
      # Chosen at sign-up, activated only when that sign-up is confirmed with
      # the emailed code (see User#activate_pending_password!).
      t.string(:pending_password_digest)
      t.datetime(:password_changed_at)
      t.integer(:failed_password_attempts, null: false, default: 0)
      t.datetime(:password_locked_until)
      # Session tokens issued before this are no longer accepted.
      t.datetime(:sessions_revoked_at)
    end
  end
end
