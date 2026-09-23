class CreatePages < ActiveRecord::Migration[8.0]
  def change
    create_table(:pages) do |t|
      t.references(:user, null: false, foreign_key: true)
      t.string(:slug, null: false)
      t.string(:display_title)
      t.text(:bio)
      t.string(:theme, null: false, default: "default")
      t.boolean(:published, null: false, default: true)
      t.datetime(:expires_at)
      t.datetime(:deleted_at)
      t.timestamps
    end
    add_index(:pages, :slug, unique: true)
    add_index(:pages, :deleted_at)
  end
end
