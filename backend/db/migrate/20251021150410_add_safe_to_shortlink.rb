class AddSafeToShortlink < ActiveRecord::Migration[8.0]
  def change
    # is safe unless provider says otherwise
    add_column :shortlinks, :safe, :boolean, default: true, null: false
    add_column :shortlinks, :safe_checked_at, :datetime
  end
end
