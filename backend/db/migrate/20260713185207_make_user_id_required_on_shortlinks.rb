class MakeUserIdRequiredOnShortlinks < ActiveRecord::Migration[8.0]
  def up
    # Remove orphan shortlinks (no user) before adding constraint
    execute "DELETE FROM shortlinks WHERE user_id IS NULL"
    change_column_null :shortlinks, :user_id, false
  end

  def down
    change_column_null :shortlinks, :user_id, true
  end
end
