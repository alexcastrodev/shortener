class AddSafetyToPageLinks < ActiveRecord::Migration[8.0]
  def change
    add_column(:page_links, :safe, :boolean, null: false, default: true)
    add_column(:page_links, :safe_checked_at, :datetime)
  end
end
