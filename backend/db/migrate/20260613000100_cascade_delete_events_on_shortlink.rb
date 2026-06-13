class CascadeDeleteEventsOnShortlink < ActiveRecord::Migration[8.0]
  def up
    remove_foreign_key(:events, :shortlinks)
    add_foreign_key(:events, :shortlinks, on_delete: :cascade)
  end

  def down
    remove_foreign_key(:events, :shortlinks)
    add_foreign_key(:events, :shortlinks)
  end
end
