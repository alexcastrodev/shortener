module Mcp
  module Tools
    class GetSummary < Mcp::BaseTool
      tool_name "get_summary"
      title "Form summary"
      description "Aggregates of a form: funnel, per-day counts, audience buckets and per-question tallies. Free text is never included, only counts."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 }, days: { type: "integer", enum: [7, 30, 90] } }, required: ["form_id"], additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "responses:read"

      def self.perform(user:, form_id:, days: 30)
        form = Mcp::Guards.form(user, form_id)
        Forms::Summary.call(form: form, days: days, text_samples: false).deep_stringify_keys.merge("content_trust" => "aggregates_only").deep_symbolize_keys
      end
    end
  end
end
