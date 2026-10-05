module Mcp
  module Tools
    class ApplyFormTemplate < Mcp::BaseTool
      tool_name "apply_form_template"
      title "Apply a template to a form"
      description "Replaces the questions, theme and thank-you message of a form without responses with a built-in template. Needs full access."
      input_schema(properties: { id: { type: "integer", minimum: 1 }, template: { type: "string", maxLength: 40 } }, required: ["id", "template"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: true, open_world_hint: false)
      requires "account:full", writes: true, limits: [[30, 1.hour]]

      def self.perform(user:, id:, template:)
        form = Mcp::Guards.form(user, id)
        FormToolHelpers.form_json(Forms::Definition.apply_template(form, template))
      end
    end
  end
end
