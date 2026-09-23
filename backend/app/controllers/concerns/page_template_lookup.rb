# Template ids: built-ins by key ("creator"), the user's own as
# "custom-<id>" (originals), Community ones as "community-<id>" (the
# placeholder version, never the author's texts or links).
module PageTemplateLookup
  extend ActiveSupport::Concern

  CUSTOM_PREFIX = "custom-"
  COMMUNITY_PREFIX = "community-"

  private

  # Returns { "theme", "items", "community" (the PageTemplate when it comes
  # from the Community gallery) }.
  def find_template(id)
    id = id.to_s
    if id.start_with?(CUSTOM_PREFIX)
      template = @current_user.page_templates.find(id.delete_prefix(CUSTOM_PREFIX))
      { "theme" => template.theme, "items" => template.items }
    elsif id.start_with?(COMMUNITY_PREFIX)
      template = PageTemplate.listed.find(id.delete_prefix(COMMUNITY_PREFIX))
      { "theme" => template.theme, "items" => template.public_items, "community" => template }
    else
      BuiltInPageTemplates.find(id) || raise(ActiveRecord::RecordNotFound)
    end
  end

  # Using someone else's Community template counts as a use.
  def count_template_use(template)
    community = template["community"]
    return if community.nil? || community.user_id == @current_user.id

    PageTemplate.update_counters(community.id, uses_count: 1)
  end

  # The owner's view: originals, plus the public version for the preview.
  def serialize_custom(template)
    {
      "id" => "#{CUSTOM_PREFIX}#{template.id}",
      "name" => template.name,
      "description" => template.description,
      "theme" => template.theme,
      "items" => template.items,
      "public_items" => template.public_items,
      "visibility" => template.visibility,
      "hidden" => template.hidden_at.present?,
      "uses_count" => template.uses_count,
      "author" => serialize_author(template),
      "built_in" => false,
    }
  end

  # Everyone else's view. The author's email never appears anywhere.
  def serialize_community(template, author_slugs:)
    {
      "id" => "#{COMMUNITY_PREFIX}#{template.id}",
      "name" => template.name,
      "description" => template.description,
      "theme" => template.theme,
      "items" => template.public_items,
      "uses_count" => template.uses_count,
      "author" => serialize_author(template, author_slugs: author_slugs),
      "built_in" => false,
      "community" => true,
      "mine" => template.user_id == @current_user.id,
    }
  end

  # "by Title · @slug"; the link only while the author's page is public.
  def serialize_author(template, author_slugs: nil)
    return if template.author_label.blank?

    author_slugs ||= visible_author_slugs([template])
    { "label" => template.author_label, "slug" => author_slugs[template.author_page_id] }
  end

  # { page_id => slug } for the templates' author pages that are public.
  def visible_author_slugs(templates)
    Page.visible.where(id: templates.map(&:author_page_id).compact).pluck(:id, :slug).to_h
  end
end
