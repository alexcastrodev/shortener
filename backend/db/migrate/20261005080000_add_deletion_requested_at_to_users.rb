class AddDeletionRequestedAtToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column(:users, :deletion_requested_at, :datetime)
    add_index(:users, :deletion_requested_at, where: "deletion_requested_at IS NOT NULL")
  end
end
