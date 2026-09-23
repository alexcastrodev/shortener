class AddClickedAtIndexToPageLinkClicks < ActiveRecord::Migration[8.1]
  # Page statistics filter each link's clicks by date.
  def change
    add_index(:page_link_clicks, [:page_link_id, :clicked_at])
  end
end
