module Mcp
  module Tools
    class CreateForm < Mcp::BaseTool
      tool_name "create_form"
      title "Create a form draft"
      description "Creates an unpublished, empty form. At most 20 new forms a day. It is never published by this tool."
      input_schema(
        properties: {
          title: { type: "string", maxLength: Form::TITLE_MAX },
          description: { type: "string", maxLength: 1000 },
          thank_you_message: { type: "string", maxLength: 500 },
          theme: { type: "string", enum: Page::THEMES },
          custom_colors: CustomColors::JSON_SCHEMA,
          layout: { type: "string", enum: Form::LAYOUTS },
        },
        required: ["title"],
        additionalProperties: false,
      )
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: false, open_world_hint: false)
      requires "forms:write", writes: true

      def self.perform(user:, **attributes)
        validated = Mcp::Guards.contract!(FormContract, attributes)
        FormToolHelpers.draft_note(FormToolHelpers.form_json(Forms::Create.call(user: user, attributes: validated)))
      end
    end
  end
end
