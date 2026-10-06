module Mcp
  module Tools
    module AppointmentToolHelpers
      PAGE_MAX = 20
      AGENDA_MAX_SESSIONS = 300

      MANAGE_LIMITS = [[30, 1.hour], [100, 1.day]].freeze
      MESSAGE_MAX = 500

      def self.manage!(user, id, confirm)
        row = Appointment.where(form_id: user.forms.select(:id)).find(id)
        raise Mcp::ToolError.new("confirmation_mismatch", "To confirm, pass the appointment id again as confirm, and only after the owner agreed") unless confirm.to_s.strip == id.to_s

        Throttle.check!(user, "appointment_manage", MANAGE_LIMITS)
        row
      end

      def self.note(value)
        Content.clean(value, max: MESSAGE_MAX).strip.presence
      end

      def self.state(row)
        { id: row.id, status: row.reload.status }
      end

      def self.date(value)
        Date.iso8601(value.to_s)
      rescue Date::Error
        raise Mcp::ToolError.new("invalid_input", "Dates must look like 2026-11-02")
      end

      def self.range(from, to)
        first = date(from)
        last = date(to)
        raise Mcp::ToolError.new("invalid_input", "The range must be 1 to #{Appointments::Slots::MAX_RANGE_DAYS} days") if last < first || (last - first) >= Appointments::Slots::MAX_RANGE_DAYS

        [first, last]
      end

      def self.booking(form)
        Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" } ||
          raise(Mcp::ToolError.new("no_booking", "This form has no booking question"))
      end

      def self.person(appointment, budget)
        {
          id: appointment.id,
          status: appointment.status,
          group_key: appointment.group_key,
          client_name: Untrusted.text(appointment.client_name, budget),
          client_email: Untrusted.text(appointment.client_email, budget),
          cancel_reason: appointment.cancel_reason && Untrusted.text(appointment.cancel_reason, budget),
        }
      end

      def self.appointment_json(appointment, budget)
        person(appointment, budget).merge(
          form_id: appointment.form_id,
          starts_at: appointment.slot.starts_at.utc.iso8601,
          service: Content.clean(appointment.snapshot["name"], max: 100),
          created_at: appointment.created_at.utc.iso8601,
          price: price(appointment),
        ).compact
      end

      def self.price(appointment)
        snapshot = appointment.snapshot
        { total: snapshot["total"], currency: snapshot["currency"], free_sessions: snapshot["free_sessions"] } if snapshot["total"]
      end

      def self.page(rows)
        pool = Untrusted.budget(Untrusted::PAGE_MAX)
        rows.map do |row|
          own = { response: Untrusted::RESPONSE_MAX, page: pool[:page] }
          json = appointment_json(row, own)
          pool[:page] = own[:page]
          json
        end
      end
    end
  end
end
