module Mcp
  module Tools
    class GetForm < Mcp::BaseTool
      tool_name "get_form"
      title "Get a form"
      description "One form with its questions and sections (ids, types, choices), layout and short link. Never includes responses."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "forms:read"

      def self.perform(user:, id:)
        FormToolHelpers.form_json(Mcp::Guards.form(user, id))
      end
    end
  end
end
