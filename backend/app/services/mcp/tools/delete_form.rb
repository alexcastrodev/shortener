module Mcp
  module Tools
    class DeleteForm < Mcp::BaseTool
      tool_name "delete_form"
      title "Delete a form"
      description "Permanently deletes a form with all its responses and uploaded files. This cannot be undone. Pass its exact title as confirm. Ask the user to confirm first. Needs full access."
      input_schema(properties: { id: { type: "integer", minimum: 1 }, confirm: { type: "string", maxLength: 200 } }, required: ["id", "confirm"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: false, open_world_hint: false)
      requires "account:full", writes: true, limits: [[10, 1.hour], [30, 1.day]]

      def self.perform(user:, id:, confirm:)
        form = Mcp::Guards.form(user, id)
        Mcp::Guards.confirm!(form.title, confirm, "title")
        responses = form.responses_count
        form.destroy!
        { deleted: true, id: id, responses_deleted: responses }
      end
    end
  end
end
