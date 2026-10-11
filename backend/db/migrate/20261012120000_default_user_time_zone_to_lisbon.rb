class DefaultUserTimeZoneToLisbon < ActiveRecord::Migration[8.1]
  def up
    change_column_default(:users, :time_zone, from: "UTC", to: "Europe/Lisbon")
    execute("UPDATE users SET time_zone = 'Europe/Lisbon' WHERE time_zone = 'UTC'")
  end

  def down
    change_column_default(:users, :time_zone, from: "Europe/Lisbon", to: "UTC")
  end
end
