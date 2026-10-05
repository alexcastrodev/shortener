module Mcp
  module Tools
    class UnpublishForm < Mcp::BaseTool
      tool_name "unpublish_form"
      title "Unpublish a form"
      description "Takes a form offline so it stops accepting answers. Its responses are kept and it can be published again."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "forms:publish", writes: true, limits: [[30, 1.hour]]

      def self.perform(user:, id:)
        form = Mcp::Guards.form(user, id)
        Forms::Unpublish.call(form: form)
        FormToolHelpers.form_json(form)
      end
    end
  end
end
