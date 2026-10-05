module Mcp
  module Tools
    class DeleteAllResponses < Mcp::BaseTool
      tool_name "delete_all_responses"
      title "Delete all responses of a form"
      description "Permanently deletes every response of a form and its uploaded files; the form itself stays. This cannot be undone. Pass the form's exact title as confirm. Ask the user to confirm first. Needs full access."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 }, confirm: { type: "string", maxLength: 200 } }, required: ["form_id", "confirm"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: false, open_world_hint: false)
      requires "account:full", writes: true, limits: [[10, 1.hour], [30, 1.day]]

      def self.perform(user:, form_id:, confirm:)
        form = Mcp::Guards.form(user, form_id)
        Mcp::Guards.confirm!(form.title, confirm, "title")
        count = form.responses_count
        form.uploads.where.not(response_id: nil).find_each(&:destroy)
        form.responses.delete_all
        form.update_column(:responses_count, 0)
        { deleted: true, responses_deleted: count }
      end
    end
  end
end
