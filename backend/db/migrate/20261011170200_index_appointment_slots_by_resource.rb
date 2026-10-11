class IndexAppointmentSlotsByResource < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_index(:appointment_slots, [:form_id, :resource_key, :starts_at], unique: true, algorithm: :concurrently, name: "index_appointment_slots_on_form_resource_start")
  end
end
