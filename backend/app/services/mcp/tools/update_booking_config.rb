module Mcp
  module Tools
    class UpdateBookingConfig < Mcp::BaseTool
      tool_name "update_booking_config"
      title "Set up the booking of a form draft"
      description "Creates the booking question of an unpublished form if it has none, and sets its services, rules and days off. Services and exceptions are replaced as a whole: send the id of a service you want to keep. Rules are merged. It never publishes."
      input_schema(
        properties: {
          form_id: { type: "integer", minimum: 1 },
          services: { type: "array", maxItems: 20, items: BookingConfigHelpers::SERVICE },
          rules: BookingConfigHelpers::RULES,
          exceptions: { type: "array", maxItems: 100, items: BookingConfigHelpers::EXCEPTION },
        },
        required: ["form_id"],
        additionalProperties: false,
      )
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "appointments:write", writes: true, limits: [[60, 1.hour]]

      def self.perform(user:, form_id:, services: nil, rules: nil, exceptions: nil)
        AppointmentToolHelpers.ensure!(user)
        form = Mcp::Guards.draft_form(user, form_id)
        changes = Mcp::Guards.contract!(FormFieldUpdateContract, { services: services, rules: rules, exceptions: exceptions })
        existing = form.fields.find { |field| field["type"] == "booking" }
        if existing
          Forms::Definition.update(form, existing["id"], changes)
        else
          Forms::Definition.add(form, { type: "booking", label: "When would you like to come?" }.merge(changes))
        end
        BookingConfigHelpers.config_json(form.reload, BookingConfigHelpers.draft_booking(form))
      end
    end
  end
end
