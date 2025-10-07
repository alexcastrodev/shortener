class CreateShortlinks < ActiveRecord::Migration[8.0]
  def change
    create_table :shortlinks do |t|
      t.string :original_url, null: false
      t.string :short_code, null: false, index: { unique: true }
      t.integer :click_count, default: 0, null: false
      t.datetime :last_accessed_at
      t.string :title

      
      t.timestamps
      
      t.references :user, null: false, foreign_key: true
    end
  end
end
