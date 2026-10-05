class CreateColorPalettes < ActiveRecord::Migration[8.1]
  def change
    create_table(:color_palettes) do |t|
      t.references(:user, null: false, foreign_key: { on_delete: :cascade }, index: true)
      t.string(:name, null: false)
      t.jsonb(:custom_colors, null: false)
      t.timestamps
    end
  end
end
