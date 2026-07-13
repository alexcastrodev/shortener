class AddShortlinksCountToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :shortlinks_count, :integer, default: 0, null: false

    # Backfill existing counts so counter_culture stays consistent.
    execute <<~SQL
      UPDATE users
      SET shortlinks_count = (
        SELECT COUNT(*)
        FROM shortlinks
        WHERE shortlinks.user_id = users.id
      )
    SQL
  end

  def down
    remove_column :users, :shortlinks_count
  end
end
