class AddCounter < ActiveRecord::Migration[8.0]
  def change
    remove_column :shortlinks, :click_count, :integer
    add_column :shortlinks, :event_count, :integer, null: false, default: 0
  end
end
