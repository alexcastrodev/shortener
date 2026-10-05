module Mcp
  module Tools
    class ListForms < Mcp::BaseTool
      tool_name "list_forms"
      title "List forms"
      description "Lists the user's forms with their counters. Never includes responses."
      input_schema(properties: {}, additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "forms:read"

      def self.perform(user:)
        { forms: user.forms.order(created_at: :desc).map { |form| FormToolHelpers.form_json(form, detail: false) } }
      end
    end
  end
end
