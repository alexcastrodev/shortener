class CreateEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :events do |t|
      t.string :ip_address
      t.string :user_agent
      t.string :referer
      t.string :country_code
      t.string :region
      t.string :platform
      t.string :browser
      t.datetime :clicked_at, null: false

      t.references :shortlink, null: false, foreign_key: true 
    end
  end
end
