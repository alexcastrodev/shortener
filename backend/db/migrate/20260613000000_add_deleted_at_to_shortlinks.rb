class AddDeletedAtToShortlinks < ActiveRecord::Migration[8.0]
  def change
    add_column(:shortlinks, :deleted_at, :datetime)
    add_index(:shortlinks, :deleted_at)
  end
end
