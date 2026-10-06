module Mcp
  module Tools
    class GetBookingImpact < Mcp::BaseTool
      tool_name "get_booking_impact"
      title "See what the draft would do to upcoming bookings"
      description "Compares the booking setup of the form draft with the bookings that are still ahead: how many would no longer match a service or a time. Ids and counts only."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 } }, required: ["form_id"], additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "appointments:read"

      def self.perform(user:, form_id:)
        form = Mcp::Guards.form(user, form_id)
        BookingConfigHelpers.draft_booking(form)
        { form_id: form.id }.merge(Appointments::Impact.call(form: form))
      end
    end
  end
end
