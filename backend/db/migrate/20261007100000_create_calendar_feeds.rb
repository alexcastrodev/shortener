class CreateCalendarFeeds < ActiveRecord::Migration[8.1]
  def change
    create_table :calendar_feeds do |t|
      t.references :user, null: false, index: { unique: true }, foreign_key: true
      t.string :digest, null: false, limit: 64
      t.datetime :last_fetched_at
      t.datetime :created_at, null: false
    end
    add_index :calendar_feeds, :digest, unique: true
  end
end
