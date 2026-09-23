# Template ids: built-ins by key ("creator"), saved ones as "custom-<id>",
# resolved only among the current user's templates.
module PageTemplateLookup
  extend ActiveSupport::Concern

  CUSTOM_PREFIX = "custom-"

  private

  def find_template(id)
    id = id.to_s
    if id.start_with?(CUSTOM_PREFIX)
      template = @current_user.page_templates.find(id.delete_prefix(CUSTOM_PREFIX))
      { "theme" => template.theme, "items" => template.items }
    else
      BuiltInPageTemplates.find(id) || raise(ActiveRecord::RecordNotFound)
    end
  end

  def serialize_custom(template)
    {
      "id" => "#{CUSTOM_PREFIX}#{template.id}",
      "name" => template.name,
      "description" => nil,
      "theme" => template.theme,
      "items" => template.items,
      "built_in" => false,
    }
  end
end
