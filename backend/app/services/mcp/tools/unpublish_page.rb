module Mcp
  module Tools
    class UnpublishPage < Mcp::BaseTool
      tool_name "unpublish_page"
      title "Unpublish a bio page"
      description "Takes a bio page offline. Its links and statistics are kept and it can be published again."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "pages:publish", writes: true, limits: [[30, 1.hour]]

      def self.perform(user:, id:)
        page = Mcp::Guards.page(user, id)
        page.update!(published: false)
        PageToolHelpers.page_json(page, links: true)
      end
    end
  end
end
