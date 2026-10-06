class AddCoverAndIntroToForms < ActiveRecord::Migration[8.1]
  def change
    add_column :forms, :cover_token, :string, limit: 24
    add_column :forms, :cover_position, :integer, default: 50, null: false
    add_column :forms, :intro_enabled, :boolean, default: false, null: false
    add_column :forms, :start_label, :string, limit: 40
  end
end
