class IndexEmail < ActiveRecord::Migration[8.0]
  def change
    remove_index :users, :email
    add_index :users, 'lower(email)', unique: true
  end
end
