class AddDurationToAppointmentSlots < ActiveRecord::Migration[8.1]
  def change
    add_column(:appointment_slots, :duration, :integer)
  end
end
