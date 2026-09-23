class CreatePageLinkClicks < ActiveRecord::Migration[8.0]
  def change
    create_table(:page_link_clicks) do |t|
      t.references(:page_link, null: false, foreign_key: { on_delete: :cascade })
      t.datetime(:clicked_at, null: false)
      t.string(:ip_address)
      t.string(:user_agent)
      t.string(:referer)
      t.string(:country_code)
      t.string(:region)
      t.string(:platform)
      t.string(:browser)
    end
  end
end
