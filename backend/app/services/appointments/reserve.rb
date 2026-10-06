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

    def call(form:, service_key:, capacity:, times:, held: false)
      ids = []
      AppointmentSlot.transaction(requires_new: true) do
        times.map(&:utc).uniq.sort.each do |starts_at|
          slot = AppointmentSlot.where(form_id: form.id, service_key: service_key, starts_at: starts_at)
          AppointmentSlot.insert_all(
            [{ form_id: form.id, service_key: service_key, starts_at: starts_at, capacity: capacity, booked: 0 }],
            unique_by: :index_appointment_slots_on_form_service_start,
          )
          if held
            raise Full, starts_at if slot.where("held > 0").update_all(["booked = booked + 1, held = held - 1, capacity = ?, updated_at = NOW()", capacity]).zero?
          else
            open = capacity ? slot.where("booked + held < ?", capacity) : slot
            raise Full, starts_at if open.update_all(["booked = booked + 1, capacity = ?, updated_at = NOW()", capacity]).zero?
          end

          ids << slot.pick(:id)
        end
      end
      ids
    end
  end
end
