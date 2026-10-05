class AddLayoutToForms < ActiveRecord::Migration[8.1]
  def change
    add_column(:forms, :layout, :string, null: false, default: "one_at_a_time")
  end
end
