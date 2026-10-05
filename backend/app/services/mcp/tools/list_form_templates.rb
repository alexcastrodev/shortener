module Mcp
  module Tools
    class ListFormTemplates < Mcp::BaseTool
      tool_name "list_form_templates"
      title "List form templates"
      description "The built-in form templates."
      input_schema(properties: {}, additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "forms:read"

      def self.perform(user:)
        { templates: BuiltInFormTemplates.all.map { |t| { id: t["id"], name: t["name"], description: t["description"], questions: t["fields"].size } } }
      end
    end
  end
end
