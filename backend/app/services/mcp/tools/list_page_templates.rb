module Mcp
  module Tools
    class ListPageTemplates < Mcp::BaseTool
      tool_name "list_page_templates"
      title "List page templates"
      description "Built-in templates and the user's own saved templates. Community templates are never listed."
      input_schema(properties: {}, additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "pages:read"

      def self.perform(user:)
        built_in = BuiltInPageTemplates.all.map { |t| { id: t["id"], name: t["name"], description: t["description"], theme: t["theme"], items: t["items"].size } }
        own = user.page_templates.order(created_at: :desc).map do |t|
          { id: "custom-#{t.id}", name: Mcp::Content.clean(t.name, max: 80), description: Mcp::Content.clean(t.description, max: 200), theme: t.theme, items: t.items.size }
        end
        { templates: built_in + own }
      end
    end
  end
end
