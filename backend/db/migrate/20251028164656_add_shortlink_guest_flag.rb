class AddShortlinkGuestFlag < ActiveRecord::Migration[8.0]
  def change
    add_column :shortlinks, :created_by_guest, :boolean, default: false

    Shortlink.find_each do |s|
      s.update_column(:created_by_guest, s.user.blank?)
    end
  end
end
