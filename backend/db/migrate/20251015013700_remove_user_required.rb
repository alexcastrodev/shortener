class RemoveUserRequired < ActiveRecord::Migration[8.0]
  def change
    change_column_null :shortlinks, :user_id, true
    remove_foreign_key :shortlinks, :users
  end
end
