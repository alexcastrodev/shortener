# frozen_string_literal: true

# What anonymous visitors of /u/:slug get: no owner data, no counters, and
# only the links the owner left active that Safe Browsing has not flagged.
class PublicPageSerializer < BaseSerializer
  root_key :page

  attributes :slug, :display_title, :bio, :theme, :avatar_url

  attribute :links do |page|
    page.page_links.select { |link| link.active && link.safe }.map do |link|
      { id: link.id, kind: link.kind, label: link.label, url: link.url, icon: link.icon }
    end
  end
end
