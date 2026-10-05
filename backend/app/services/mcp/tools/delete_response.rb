module Mcp
  module Tools
    class DeleteResponse < Mcp::BaseTool
      tool_name "delete_response"
      title "Delete one form response"
      description "Permanently deletes one response of a form, with its uploaded files. Needs full access."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 }, id: { type: "integer", minimum: 1 } }, required: ["form_id", "id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: false, open_world_hint: false)
      requires "account:full", writes: true, limits: [[100, 1.hour], [500, 1.day]]

      def self.perform(user:, form_id:, id:)
        Mcp::Guards.form(user, form_id).responses.find(id).destroy!
        { deleted: true, id: id }
      end
    end
  end
end
