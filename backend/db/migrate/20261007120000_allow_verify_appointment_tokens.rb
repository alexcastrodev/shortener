class AllowVerifyAppointmentTokens < ActiveRecord::Migration[8.1]
  def up
    remove_check_constraint(:appointment_tokens, name: "appointment_tokens_purpose_known")
    add_check_constraint(:appointment_tokens, "purpose IN ('manage', 'approve', 'decline', 'decide', 'verify')", name: "appointment_tokens_purpose_known")
    remove_index(:appointments, name: "index_appointments_pending_expires_at")
    add_index(:appointments, :expires_at, name: "index_appointments_pending_expires_at", where: "status IN ('pending', 'unverified')")
  end

  def down
    remove_index(:appointments, name: "index_appointments_pending_expires_at")
    add_index(:appointments, :expires_at, name: "index_appointments_pending_expires_at", where: "status = 'pending'")
    remove_check_constraint(:appointment_tokens, name: "appointment_tokens_purpose_known")
    add_check_constraint(:appointment_tokens, "purpose IN ('manage', 'approve', 'decline', 'decide')", name: "appointment_tokens_purpose_known")
  end
end
