module Mcp
  module Tools
    class ApplyTimeSlots < Mcp::BaseTool
      tool_name "apply_time_slots"
      title "Fill the times of a service from working hours"
      description "Works out the times of a working day (start, end, step, optional lunch and breaks) and sets them as the usual times of one service of an unpublished form. Special weekdays and exceptions are not touched."
      input_schema(
        properties: {
          form_id: { type: "integer", minimum: 1 },
          service_id: { type: "string", maxLength: 8 },
          from: { type: "string", maxLength: 5 },
          to: { type: "string", maxLength: 5 },
          step: { type: "integer", minimum: 5, maximum: 600 },
          lunch: BookingConfigHelpers::BREAK,
          blocks: { type: "array", maxItems: 10, items: BookingConfigHelpers::BREAK },
        },
        required: ["form_id", "service_id", "from", "to", "step"],
        additionalProperties: false,
      )
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "appointments:write", writes: true, limits: [[60, 1.hour]]

      def self.perform(user:, form_id:, service_id:, from:, to:, step:, lunch: nil, blocks: [])
        AppointmentToolHelpers.ensure!(user)
        form = Mcp::Guards.draft_form(user, form_id)
        booking = BookingConfigHelpers.draft_booking(form)
        service = booking["services"].find { |item| item["id"] == service_id } || raise(Mcp::ToolError.new("not_found", "Not found"))
        result = Appointments::GenerateTimes.call(from: from, to: to, step: step, duration: service["duration"], lunch: lunch&.symbolize_keys, blocks: blocks.map(&:symbolize_keys))
        raise Mcp::ToolError.new("invalid_input", result.errors.to_sentence) if result.errors.any?

        services = booking["services"].map { |item| item["id"] == service_id ? item.merge("times" => result.times) : item }
        Forms::Definition.update(form, booking["id"], { "services" => services })
        { form_id: form.id, service_id: service_id, times: result.times, warnings: result.warnings }
      end
    end
  end
end
