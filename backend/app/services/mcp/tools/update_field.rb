module Mcp
  module Tools
    class UpdateField < Mcp::BaseTool
      tool_name "update_field"
      title "Edit a question of a form draft"
      description "Edits a question of an unpublished form that has no responses. The type of a question cannot change."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 }, field_id: { type: "string", maxLength: 8 } }.merge(FormToolHelpers::FIELD_PROPERTIES.except(:type)), required: ["form_id", "field_id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "forms:write", writes: true

      def self.perform(user:, form_id:, field_id:, **changes)
        form = Mcp::Guards.structural_form(user, form_id)
        FormToolHelpers.form_json(Forms::Definition.update(form, field_id, FormToolHelpers.field_attributes(changes)))
      end
    end
  end
end
