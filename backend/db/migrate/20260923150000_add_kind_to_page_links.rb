class AddKindToPageLinks < ActiveRecord::Migration[8.0]
  def change
    # link: a button; social: an icon in the row under the page title;
    # header: a section title (no URL) grouping the items below it.
    add_column(:page_links, :kind, :string, null: false, default: "link")
    change_column_null(:page_links, :url, true)
  end
end
