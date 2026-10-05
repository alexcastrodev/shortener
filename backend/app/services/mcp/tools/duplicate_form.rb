module Mcp
  module Tools
    class DuplicateForm < Mcp::BaseTool
      tool_name "duplicate_form"
      title "Duplicate a form"
      description "Creates an unpublished copy of a form with the same questions and style, without its responses. Counts toward the 20 new forms a day. Needs full access."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: false, open_world_hint: false)
      requires "account:full", writes: true, limits: [[20, 1.hour]]

      def self.perform(user:, id:)
        form = Mcp::Guards.form(user, id)
        copy = Forms::Create.call(
          user: user,
          attributes: {
            title: "Copy of #{form.title}".first(Form::TITLE_MAX),
            description: form.description,
            thank_you_message: form.thank_you_message,
            theme: form.theme,
            custom_colors: form.custom_colors,
            layout: form.layout,
            fields: form.fields.map { |field| Forms::FieldSchema.with_fresh_ids(field) },
          },
        )
        FormToolHelpers.form_json(copy)
      end
    end
  end
end
