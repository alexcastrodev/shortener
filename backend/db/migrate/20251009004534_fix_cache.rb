class FixCache < ActiveRecord::Migration[8.0]
  def change
    remove_column :shortlinks, :event_count, :integer
    add_column :shortlinks, :events_count, :integer, null: false, default: 0
  end
end
