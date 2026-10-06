module Mcp
  module Tools
    class UpdateForm < Mcp::BaseTool
      tool_name "update_form"
      title "Edit a form draft"
      description "Edits the title, description, thank-you message, theme (or custom_colors) layout (one_at_a_time, page or steps), intro screen (intro_enabled) or the text of its start button of a form. The cover image can only be changed in the app. A published form accepts only theme and custom_colors changes; unpublish it to edit the rest."
      input_schema(
        properties: {
          id: { type: "integer", minimum: 1 },
          title: { type: "string", maxLength: Form::TITLE_MAX },
          description: { type: "string", maxLength: 1000 },
          thank_you_message: { type: "string", maxLength: 500 },
          theme: { type: "string", enum: Page::THEMES },
          custom_colors: CustomColors::JSON_SCHEMA,
          layout: { type: "string", enum: Form::LAYOUTS },
          intro_enabled: { type: "boolean" },
          start_label: { type: "string", maxLength: Form::START_LABEL_MAX },
        },
        required: ["id"],
        additionalProperties: false,
      )
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "forms:write", writes: true

      def self.perform(user:, id:, **changes)
        form = Mcp::Guards.editable_form(user, id, changes.keys)
        form.update!(Mcp::Guards.contract!(FormUpdateContract, changes))
        FormToolHelpers.form_json(form)
      end
    end
  end
end
