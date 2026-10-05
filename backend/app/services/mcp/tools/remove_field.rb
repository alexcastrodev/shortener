module Mcp
  module Tools
    class RemoveField < Mcp::BaseTool
      tool_name "remove_field"
      title "Remove a question from a form draft"
      description "Deletes a question of an unpublished form that has no responses."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 }, field_id: { type: "string", maxLength: 8 } }, required: ["form_id", "field_id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: true, open_world_hint: false)
      requires "forms:write", writes: true

      def self.perform(user:, form_id:, field_id:)
        FormToolHelpers.form_json(Forms::Definition.remove(Mcp::Guards.structural_form(user, form_id), field_id))
      end
    end
  end
end
