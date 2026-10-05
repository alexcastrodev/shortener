module Mcp
  module Tools
    class DeletePage < Mcp::BaseTool
      tool_name "delete_page"
      title "Delete a bio page"
      description "Deletes a bio page and takes it offline. Pass its exact slug as confirm. Ask the user to confirm first. Needs full access."
      input_schema(properties: { id: { type: "integer", minimum: 1 }, confirm: { type: "string", maxLength: 64 } }, required: ["id", "confirm"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: false, open_world_hint: false)
      requires "account:full", writes: true, limits: [[10, 1.hour], [30, 1.day]]

      def self.perform(user:, id:, confirm:)
        page = Mcp::Guards.page(user, id)
        Mcp::Guards.confirm!(page.slug, confirm, "slug")
        page.soft_delete!
        { deleted: true, id: id, slug: page.slug }
      end
    end
  end
end
