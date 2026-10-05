class AddCustomColorsToPagesAndForms < ActiveRecord::Migration[8.1]
  def change
    add_column(:pages, :custom_colors, :jsonb)
    add_column(:forms, :custom_colors, :jsonb)
  end
end
