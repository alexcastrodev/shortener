require_relative "20261012090200_backfill_workspaces_of_forms"

class RequireWorkspaceOfForms < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    BackfillWorkspacesOfForms.new.up
    add_check_constraint(:forms, "workspace_id IS NOT NULL", name: "forms_workspace_id_not_null", validate: false)
    validate_check_constraint(:forms, name: "forms_workspace_id_not_null")
    change_column_null(:forms, :workspace_id, false)
    remove_check_constraint(:forms, name: "forms_workspace_id_not_null")
  end

  def down
    change_column_null(:forms, :workspace_id, true)
  end
end
