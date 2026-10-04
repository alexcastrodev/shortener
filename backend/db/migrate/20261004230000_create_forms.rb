class CreateForms < ActiveRecord::Migration[8.1]
  def change
    create_table(:forms) do |t|
      t.references(:user, null: false, foreign_key: { on_delete: :cascade })
      t.string(:public_id, null: false)
      t.string(:title, null: false)
      t.text(:description)
      t.text(:thank_you_message)
      t.string(:theme, null: false, default: "default")
      t.boolean(:published, null: false, default: false)
      t.jsonb(:fields, null: false, default: [])
      t.integer(:responses_count, null: false, default: 0)
      t.timestamps
    end
    add_index(:forms, :public_id, unique: true)
    add_index(:forms, [:user_id, :created_at])
    add_check_constraint(:forms, "jsonb_typeof(fields) = 'array'", name: "forms_fields_is_array")
  end
end
