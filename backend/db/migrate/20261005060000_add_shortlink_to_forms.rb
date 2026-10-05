class AddShortlinkToForms < ActiveRecord::Migration[8.1]
  def change
    add_reference(:forms, :shortlink, null: true, foreign_key: { on_delete: :nullify }, index: true)
  end
end
