# Replaces a page's items (and theme) with a template's, in one transaction.
module ApplyPageTemplate
  extend self

  def call(page:, theme:, items:)
    Page.transaction do
      page.page_links.destroy_all
      items.each_with_index do |item, index|
        page.page_links.create!(
          kind: item["kind"],
          label: item["label"],
          url: item["url"],
          icon: item["icon"],
          active: item.fetch("active", true),
          position: index + 1,
        )
      end
      page.update!(theme: theme)
    end
    page.page_links.reset
    page
  end
end
