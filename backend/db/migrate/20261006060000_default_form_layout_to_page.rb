class DefaultFormLayoutToPage < ActiveRecord::Migration[8.1]
  def change
    change_column_default(:forms, :layout, from: "one_at_a_time", to: "page")
  end
end
