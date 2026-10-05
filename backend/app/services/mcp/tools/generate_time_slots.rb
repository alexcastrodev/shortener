module Mcp
  module Tools
    class GenerateTimeSlots < Mcp::BaseTool
      tool_name "generate_time_slots"
      title "Generate a list of appointment times"
      description "Works out the times of a working day from a start, an end, a step and optional breaks. It only calculates: it changes nothing."
      input_schema(
        properties: {
          from: { type: "string", maxLength: 5 },
          to: { type: "string", maxLength: 5 },
          step: { type: "integer", minimum: 5, maximum: 600 },
          duration: { type: "integer", minimum: 5, maximum: 600 },
          lunch: { type: "object", properties: { from: { type: "string", maxLength: 5 }, to: { type: "string", maxLength: 5 } }, required: ["from", "to"], additionalProperties: false },
          blocks: { type: "array", maxItems: 10, items: { type: "object", properties: { from: { type: "string", maxLength: 5 }, to: { type: "string", maxLength: 5 } }, required: ["from", "to"], additionalProperties: false } },
        },
        required: ["from", "to", "step"],
        additionalProperties: false,
      )
      annotations(read_only_hint: true, open_world_hint: false)
      requires "appointments:read"

      def self.perform(user:, from:, to:, step:, duration: 60, lunch: nil, blocks: [])
        AppointmentToolHelpers.ensure!(user)
        result = Appointments::GenerateTimes.call(from: from, to: to, step: step, duration: duration, lunch: lunch&.symbolize_keys, blocks: blocks.map(&:symbolize_keys))
        { times: result.times, warnings: result.warnings, errors: result.errors }
      end
    end
  end
end
