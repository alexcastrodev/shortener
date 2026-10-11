require_relative "20261011170100_backfill_resource_key_of_appointment_slots"

class RequireResourceKeyOfAppointmentSlots < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    BackfillResourceKeyOfAppointmentSlots.new.up
    add_check_constraint(:appointment_slots, "resource_key IS NOT NULL", name: "appointment_slots_resource_key_not_null", validate: false)
    validate_check_constraint(:appointment_slots, name: "appointment_slots_resource_key_not_null")
    change_column_null(:appointment_slots, :resource_key, false)
    remove_check_constraint(:appointment_slots, name: "appointment_slots_resource_key_not_null")
  end

  def down
    change_column_null(:appointment_slots, :resource_key, true)
  end
end
