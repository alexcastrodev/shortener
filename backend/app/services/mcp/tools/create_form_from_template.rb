module Mcp
  module Tools
    class CreateFormFromTemplate < Mcp::BaseTool
      tool_name "create_form_from_template"
      title "Create a form draft from a template"
      description "Creates an unpublished form from a built-in template. Counts toward the 20 new forms a day."
      input_schema(properties: { template: { type: "string", maxLength: 40 }, title: { type: "string", maxLength: Form::TITLE_MAX } }, required: ["template"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: false, open_world_hint: false)
      requires "forms:write", writes: true

      def self.perform(user:, template:, title: nil)
        built = BuiltInFormTemplates.build(template) || raise(Mcp::ToolError.new("invalid_input", "Unknown template"))
        built["title"] = title if title.present?
        FormToolHelpers.draft_note(FormToolHelpers.form_json(Forms::Create.call(user: user, attributes: built.symbolize_keys)))
      end
    end
  end
end
