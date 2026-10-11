class AddWorkspaceToForms < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column(:forms, :workspace_id, :bigint)
    add_index(:forms, :workspace_id, algorithm: :concurrently)
    add_foreign_key(:forms, :workspaces, column: [:workspace_id, :user_id], primary_key: [:id, :user_id], validate: false)
  end
end
