module Mcp
  module Tools
    class AddField < Mcp::BaseTool
      tool_name "add_field"
      title "Add a question to a form draft"
      description "Adds a question to an unpublished form that has no responses yet."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 } }.merge(FormToolHelpers::FIELD_PROPERTIES), required: ["form_id", "type", "label"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: false, open_world_hint: false)
      requires "forms:write", writes: true

      def self.perform(user:, form_id:, **field)
        form = Mcp::Guards.structural_form(user, form_id)
        FormToolHelpers.form_json(Forms::Definition.add(form, FormToolHelpers.field_attributes(field)))
      end
    end
  end
end
