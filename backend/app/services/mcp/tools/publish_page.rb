module Mcp
  module Tools
    class PublishPage < Mcp::BaseTool
      tool_name "publish_page"
      title "Publish a bio page"
      description "Publishes a bio page at its public address. Ask the user to confirm before calling it."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: true)
      requires "pages:publish", writes: true, limits: [[20, 1.hour], [100, 1.day]]

      def self.perform(user:, id:)
        page = Mcp::Guards.page(user, id)
        page.update!(published: true)
        PageToolHelpers.page_json(page, links: true)
      end
    end
  end
end
