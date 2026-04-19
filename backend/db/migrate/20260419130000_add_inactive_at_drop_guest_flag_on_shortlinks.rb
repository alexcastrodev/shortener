class AddInactiveAtDropGuestFlagOnShortlinks < ActiveRecord::Migration[8.0]
  def change
    add_column :shortlinks, :inactive_at, :datetime
    remove_column :shortlinks, :created_by_guest, :boolean, default: false
  end
end
