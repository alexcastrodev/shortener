module Mcp
  module Tools
    class PublishForm < Mcp::BaseTool
      tool_name "publish_form"
      title "Publish a form"
      description "Publishes a form so anyone with its link can answer it. The form needs at least one question. Ask the user to confirm before calling it."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: true)
      requires "forms:publish", writes: true, limits: [[20, 1.hour], [100, 1.day]]

      def self.perform(user:, id:)
        form = Mcp::Guards.form(user, id)
        raise Mcp::ToolError.new("no_questions", "The form needs at least one question before it can be published") if form.fields.none? { |field| Forms::FieldSchema.answerable?(field) }

        form.ensure_shortlink!
        form.update!(published: true)
        FormToolHelpers.form_json(form).merge(public_url: form.public_url)
      end
    end
  end
end
