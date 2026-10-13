class RecountUserShortlinks < ActiveRecord::Migration[8.1]
  def up
    execute(<<~SQL)
      UPDATE users
      SET shortlinks_count = counts.visible
      FROM (
        SELECT users.id, COUNT(shortlinks.id) AS visible
        FROM users
        LEFT JOIN shortlinks ON shortlinks.user_id = users.id AND shortlinks.deleted_at IS NULL
        GROUP BY users.id
      ) counts
      WHERE users.id = counts.id AND users.shortlinks_count <> counts.visible
    SQL
  end

  def down
  end
end
