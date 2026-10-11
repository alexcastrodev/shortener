class BackfillWorkspacesOfForms < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  class MigrationForm < ActiveRecord::Base
    self.table_name = "forms"
  end

  def up
    execute(<<~SQL.squish)
      INSERT INTO workspaces (user_id, name, mode, created_at, updated_at)
      SELECT DISTINCT forms.user_id, 'Main', 'services', NOW(), NOW() FROM forms
      WHERE forms.workspace_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM workspaces WHERE workspaces.user_id = forms.user_id)
    SQL
    MigrationForm.where(workspace_id: nil).in_batches(of: 1000) do |batch|
      batch.update_all("workspace_id = (SELECT MIN(workspaces.id) FROM workspaces WHERE workspaces.user_id = forms.user_id)")
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
