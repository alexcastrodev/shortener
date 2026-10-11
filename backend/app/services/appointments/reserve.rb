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

    def call(form:, service_key:, capacity:, times:, held: false, durations: {}, resource_key: service_key)
      ids = []
      AppointmentSlot.transaction(requires_new: true) do
        times.map(&:utc).uniq.sort.each do |starts_at|
          slot = AppointmentSlot.where(form_id: form.id, starts_at: starts_at).of_resource(resource_key)
          AppointmentSlot.insert_all([{ form_id: form.id, service_key: service_key, resource_key: resource_key, starts_at: starts_at, capacity: capacity, booked: 0 }])
          minutes = durations[starts_at.to_i]
          if held
            raise Full, starts_at if slot.where(service_key: service_key).where("held > 0").update_all(["booked = booked + 1, held = held - 1, capacity = ?, duration = COALESCE(?, duration), ends_at = starts_at + make_interval(mins => COALESCE(?, duration)), resource_key = ?, updated_at = NOW()", capacity, minutes, minutes, resource_key]).zero?
          else
            open = slot.where("service_key = ? OR booked + held = 0", service_key)
            open = open.where("booked + held < ?", capacity) if capacity
            raise Full, starts_at if open.update_all(["booked = booked + 1, service_key = ?, capacity = ?, duration = CASE WHEN booked + held = 0 THEN COALESCE(?, duration) ELSE duration END, ends_at = starts_at + make_interval(mins => CASE WHEN booked + held = 0 THEN COALESCE(?, duration) ELSE duration END), resource_key = ?, updated_at = NOW()", service_key, capacity, minutes, minutes, resource_key]).zero?
          end

          ids << slot.pick(:id)
        rescue ActiveRecord::ExclusionViolation, ActiveRecord::Deadlocked
          raise Full, starts_at
        end
      end
      ids
    end
  end
end
