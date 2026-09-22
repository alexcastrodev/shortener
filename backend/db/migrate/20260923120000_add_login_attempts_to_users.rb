class AddLoginAttemptsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column(:users, :login_attempts, :integer, default: 0, null: false)
  end
end
