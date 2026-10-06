module Mcp
  module Tools
    class PreviewAvailability < Mcp::BaseTool
      tool_name "preview_availability"
      title "Preview what a visitor can book"
      description "The free times a visitor would see for one service between two dates (up to 62 days), with places left. No personal data."
      input_schema(
        properties: { form_id: { type: "integer", minimum: 1 }, service_id: { type: "string", maxLength: 8 }, from: { type: "string", maxLength: 10 }, to: { type: "string", maxLength: 10 } },
        required: ["form_id", "service_id", "from", "to"],
        additionalProperties: false,
      )
      annotations(read_only_hint: true, open_world_hint: false)
      requires "appointments:read"

      def self.perform(user:, form_id:, service_id:, from:, to:)
        first, last = AppointmentToolHelpers.range(from, to)
        form = Mcp::Guards.form(user, form_id)
        booking = AppointmentToolHelpers.booking(form)
        service = booking["services"].find { |item| item["id"] == service_id } || raise(Mcp::ToolError.new("not_found", "Not found"))
        slots = Appointments::FreeSlots.call(form: form, booking: booking, service: service, from: first, to: last)
        { form_id: form.id, service_id: service_id, time_zone: booking["rules"]["time_zone"], slots: slots.map { |slot| { starts_at: slot[:starts_at].iso8601, remaining: slot[:remaining] } } }
      end
    end
  end
end
