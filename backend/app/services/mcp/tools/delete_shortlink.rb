module Mcp
  module Tools
    class DeleteShortlink < Mcp::BaseTool
      tool_name "delete_shortlink"
      title "Delete a short link"
      description "Permanently deletes a short link and stops it from redirecting. Pass its exact short_code as confirm. Ask the user to confirm first. Needs full access."
      input_schema(properties: { id: { type: "integer", minimum: 1 }, confirm: { type: "string", maxLength: 64 } }, required: ["id", "confirm"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: false, open_world_hint: false)
      requires "account:full", writes: true, limits: [[10, 1.hour], [30, 1.day]]

      def self.perform(user:, id:, confirm:)
        link = user.shortlinks.find(id)
        Mcp::Guards.confirm!(link.short_code, confirm, "short_code")
        link.soft_delete!
        { deleted: true, id: id, short_code: link.short_code }
      end
    end
  end
end
