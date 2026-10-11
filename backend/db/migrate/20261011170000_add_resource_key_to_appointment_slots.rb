class AddResourceKeyToAppointmentSlots < ActiveRecord::Migration[8.1]
  def change
    add_column(:appointment_slots, :resource_key, :string)
  end
end
