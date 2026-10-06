class AllowDecideAppointmentTokens < ActiveRecord::Migration[8.1]
  def up
    remove_check_constraint(:appointment_tokens, name: "appointment_tokens_purpose_known")
    add_check_constraint(:appointment_tokens, "purpose IN ('manage', 'approve', 'decline', 'decide')", name: "appointment_tokens_purpose_known")
  end

  def down
    remove_check_constraint(:appointment_tokens, name: "appointment_tokens_purpose_known")
    add_check_constraint(:appointment_tokens, "purpose IN ('manage', 'approve', 'decline')", name: "appointment_tokens_purpose_known")
  end
end
