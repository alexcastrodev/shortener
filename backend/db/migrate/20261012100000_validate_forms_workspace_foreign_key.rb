class ValidateFormsWorkspaceForeignKey < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key(:forms, :workspaces, column: [:workspace_id, :user_id])
  end
end
