class CreatePageTemplates < ActiveRecord::Migration[8.0]
  def change
    # Templates users save from their own pages; only visible to them.
    # Built-in templates live in code (BuiltInPageTemplates).
    create_table(:page_templates) do |t|
      t.references(:user, null: false, foreign_key: { on_delete: :cascade })
      t.string(:name, null: false)
      t.string(:theme, null: false, default: "default")
      t.jsonb(:items, null: false, default: [])
      t.timestamps
    end
  end
end
