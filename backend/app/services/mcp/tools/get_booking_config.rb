module Mcp
  module Tools
    class GetBookingConfig < Mcp::BaseTool
      tool_name "get_booking_config"
      title "Get the booking setup of a form"
      description "The services, weekly days and times, and rules of the booking question of a form. No bookings or personal data."
      input_schema(properties: { form_id: { type: "integer", minimum: 1 } }, required: ["form_id"], additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "appointments:read"

      def self.perform(user:, form_id:)
        AppointmentToolHelpers.ensure!(user)
        form = Mcp::Guards.form(user, form_id)
        booking = AppointmentToolHelpers.booking(form)
        {
          form_id: form.id,
          published: form.published,
          question: Content.clean(booking["label"], max: Forms::FieldSchema::LABEL_MAX),
          rules: booking["rules"],
          services: booking["services"].map do |service|
            service.slice("id", "duration", "price", "currency", "capacity", "days", "times").merge("name" => Content.clean(service["name"], max: 100))
          end,
        }
      end
    end
  end
end
