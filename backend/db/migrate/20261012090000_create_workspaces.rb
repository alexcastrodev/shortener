class CreateWorkspaces < ActiveRecord::Migration[8.1]
  def change
    create_table(:workspaces) do |t|
      t.references(:user, null: false, foreign_key: { on_delete: :cascade })
      t.string(:name, null: false)
      t.string(:mode, null: false, default: "services")
      t.timestamps
    end
    add_index(:workspaces, [:id, :user_id], unique: true)
  end
end
