module Mcp
  module Tools
    class GetPage < Mcp::BaseTool
      tool_name "get_page"
      title "Get a bio page"
      description "One bio page with its links."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "pages:read"

      def self.perform(user:, id:)
        PageToolHelpers.page_json(Mcp::Guards.page(user, id), links: true)
      end
    end
  end
end
