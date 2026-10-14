class AddForeignKeyShortlinksUser < ActiveRecord::Migration[8.1]
  def change
    add_foreign_key :shortlinks, :users, validate: false
  end
end
