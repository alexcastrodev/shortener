class AddOverlapGuardToAppointmentSlots < ActiveRecord::Migration[8.1]
  def change
    enable_extension("btree_gist")
    add_column(:appointment_slots, :ends_at, :datetime)
    add_exclusion_constraint(
      :appointment_slots,
      "form_id WITH =, resource_key WITH =, tsrange(starts_at, ends_at) WITH &&",
      using: :gist,
      where: "resource_key::text <> service_key::text AND booked + held > 0 AND ends_at IS NOT NULL",
      name: "appointment_slots_no_overlap_in_shared_resource",
    )
  end
end
