class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :login_token
      t.datetime :login_token_sent_at

      t.timestamps
    end

    add_index :users, :email, unique: true
    add_index :users, :login_token, unique: true
  end
end
