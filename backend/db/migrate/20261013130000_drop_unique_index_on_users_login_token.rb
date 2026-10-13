class DropUniqueIndexOnUsersLoginToken < ActiveRecord::Migration[8.1]
  def up
    remove_index(:users, name: "index_users_on_login_token", if_exists: true)
  end

  def down
    add_index(:users, :login_token, unique: true, name: "index_users_on_login_token", if_not_exists: true)
  end
end
