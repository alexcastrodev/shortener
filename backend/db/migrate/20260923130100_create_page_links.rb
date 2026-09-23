class CreatePageLinks < ActiveRecord::Migration[8.0]
  def change
    create_table(:page_links) do |t|
      t.references(:page, null: false, foreign_key: { on_delete: :cascade }, index: false)
      t.string(:label, null: false)
      t.string(:url, null: false)
      t.string(:icon)
      t.integer(:position, null: false, default: 0)
      t.boolean(:active, null: false, default: true)
      t.integer(:clicks_count, null: false, default: 0)
      t.timestamps
    end
    add_index(:page_links, [:page_id, :position])
  end
end
