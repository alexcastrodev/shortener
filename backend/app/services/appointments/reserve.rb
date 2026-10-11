module Appointments
  module Reserve
    extend self

    class Full < StandardError
      attr_reader :starts_at

      def initialize(starts_at)
        @starts_at = starts_at
        super("slot_full")
      end
    end

    def call(form:, service_key:, capacity:, times:, held: false, durations: {})
      ids = []
      AppointmentSlot.transaction(requires_new: true) do
        times.map(&:utc).uniq.sort.each do |starts_at|
          slot = AppointmentSlot.where(form_id: form.id, service_key: service_key, starts_at: starts_at)
          AppointmentSlot.insert_all(
            [{ form_id: form.id, service_key: service_key, starts_at: starts_at, capacity: capacity, booked: 0 }],
            unique_by: :index_appointment_slots_on_form_service_start,
          )
          minutes = durations[starts_at.to_i]
          if held
            raise Full, starts_at if slot.where("held > 0").update_all(["booked = booked + 1, held = held - 1, capacity = ?, duration = COALESCE(?, duration), updated_at = NOW()", capacity, minutes]).zero?
          else
            open = capacity ? slot.where("booked + held < ?", capacity) : slot
            raise Full, starts_at if open.update_all(["booked = booked + 1, capacity = ?, duration = CASE WHEN booked + held = 0 THEN COALESCE(?, duration) ELSE duration END, updated_at = NOW()", capacity, minutes]).zero?
          end

          ids << slot.pick(:id)
        end
      end
      ids
    end
  end
end
