module Appointments
  module Release
    extend self

    def call(slot_ids)
      slot_ids.tally.sort.each do |id, count|
        AppointmentSlot.where(id: id).update_all(["booked = GREATEST(booked - ?, 0), updated_at = NOW()", count])
      end
    end
  end
end
