module Mcp
  module Tools
    class ReorderFields < Mcp::BaseTool
      tool_name "reorder_fields"
      title "Reorder the questions of a form draft"
      description "Sets the order of every question of an unpublished form that has no responses. Each question id exactly once."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 }, ids: { type: "array", items: { type: "string", maxLength: 8 }, maxItems: 200 } }, required: ["form_id", "ids"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "forms:write", writes: true

      def self.perform(user:, form_id:, ids:)
        FormToolHelpers.form_json(Forms::Definition.reorder(Mcp::Guards.structural_form(user, form_id), ids))
      end
    end
  end
end
