module Mcp
  module Tools
    module BookingConfigHelpers
      DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].freeze
      TIME_LIST = { type: "array", maxItems: 96, items: { type: "string", maxLength: 5 } }.freeze
      BREAK = { type: "object", properties: { from: { type: "string", maxLength: 5 }, to: { type: "string", maxLength: 5 } }, required: ["from", "to"], additionalProperties: false }.freeze
      SERVICE = {
        type: "object",
        properties: {
          id: { type: "string", maxLength: 8 },
          name: { type: "string", maxLength: 100 },
          duration: { type: "integer", minimum: 5, maximum: 600 },
          price: { type: "number", minimum: 0 },
          currency: { type: "string", maxLength: 3 },
          capacity: { type: "integer", minimum: 1, maximum: 1000 },
          days: { type: "array", maxItems: 7, items: { type: "string", enum: DAYS } },
          times: TIME_LIST,
          times_by_day: { type: "object", properties: DAYS.to_h { |day| [day, TIME_LIST] }, additionalProperties: false },
          bundle: { type: "object", properties: { take: { type: "integer" }, pay: { type: "integer" } }, required: ["take", "pay"], additionalProperties: false },
        },
        required: ["name", "duration", "days", "times"],
        additionalProperties: false,
      }.freeze
      RULES = {
        type: "object",
        properties: {
          time_zone: { type: "string", maxLength: 64 },
          approval: { type: "string", enum: ["auto", "manual"] },
          approval_timeout_minutes: { type: "integer" },
          approval_on_timeout: { type: "string", enum: ["decline", "accept"] },
          min_notice_minutes: { type: "integer" },
          window_days: { type: "integer" },
          buffer_minutes: { type: "integer" },
          max_per_day: { type: "integer" },
        },
        additionalProperties: false,
      }.freeze
      EXCEPTION = {
        type: "object",
        properties: {
          id: { type: "string", maxLength: 8 },
          from: { type: "string", maxLength: 10 },
          to: { type: "string", maxLength: 10 },
          kind: { type: "string", enum: ["closed", "special"] },
          times: TIME_LIST,
          service_ids: { type: "array", maxItems: 20, items: { type: "string", maxLength: 8 } },
          note: { type: "string", maxLength: 200 },
        },
        required: ["from", "kind"],
        additionalProperties: false,
      }.freeze

      def self.config_json(form, booking)
        {
          form_id: form.id,
          published: form.published,
          question: Content.clean(booking["label"], max: Forms::FieldSchema::LABEL_MAX),
          rules: booking["rules"],
          services: booking["services"].map { |service| service.except("name").merge("name" => Content.clean(service["name"], max: 100)) },
          exceptions: booking["exceptions"].to_a.map { |item| item.except("note") },
        }
      end

      def self.draft_booking(form)
        form.fields.find { |field| field["type"] == "booking" } || raise(Mcp::ToolError.new("no_booking", "This form has no booking question"))
      end
    end
  end
end
