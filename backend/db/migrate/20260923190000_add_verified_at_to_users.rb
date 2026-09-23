class AddVerifiedAtToUsers < ActiveRecord::Migration[8.1]
  # Set on the first successful sign-in. Accounts that never confirm a code
  # are removed after a day (CleanupUnverifiedUsersJob), and verified ones get
  # a reserved share of the daily email budget (MailBudget).
  def up
    add_column(:users, :verified_at, :datetime)
    add_index(:users, [:verified_at, :created_at])
    # Every account that exists today was made before this column; treat them
    # as verified rather than deleting anyone.
    execute("UPDATE users SET verified_at = created_at")
  end

  def down
    remove_column(:users, :verified_at)
  end
end
