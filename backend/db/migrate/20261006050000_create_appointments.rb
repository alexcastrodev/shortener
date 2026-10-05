class CreateAppointments < ActiveRecord::Migration[8.1]
  def change
    create_table(:appointment_slots) do |t|
      t.references(:form, null: false, foreign_key: { on_delete: :cascade })
      t.string(:service_key, null: false)
      t.datetime(:starts_at, null: false)
      t.integer(:capacity)
      t.integer(:booked, default: 0, null: false)
      t.timestamps
      t.index([:form_id, :service_key, :starts_at], unique: true, name: "index_appointment_slots_on_form_service_start")
      t.check_constraint("booked >= 0", name: "appointment_slots_booked_non_negative")
      t.check_constraint("capacity IS NULL OR booked <= capacity", name: "appointment_slots_booked_within_capacity")
    end

    create_table(:appointments) do |t|
      t.references(:form, null: false, foreign_key: { on_delete: :cascade })
      t.references(:response, null: false, foreign_key: { to_table: :form_responses, on_delete: :cascade })
      t.references(:slot, null: false, foreign_key: { to_table: :appointment_slots })
      t.uuid(:group_key, null: false)
      t.string(:status, null: false)
      t.string(:client_name)
      t.string(:client_email)
      t.string(:client_phone)
      t.jsonb(:snapshot, default: {}, null: false)
      t.integer(:published_version)
      t.datetime(:expires_at)
      t.datetime(:decided_at)
      t.string(:decided_by)
      t.text(:decision_message)
      t.text(:cancel_reason)
      t.string(:cancelled_by)
      t.references(:rescheduled_from, foreign_key: { to_table: :appointments, on_delete: :nullify })
      t.string(:client_time_zone)
      t.string(:client_locale)
      t.datetime(:reminder_sent_at)
      t.datetime(:owner_nudged_at)
      t.datetime(:created_at, null: false)
      t.index([:form_id, :status])
      t.index([:group_key])
      t.index([:expires_at], where: "status = 'pending'", name: "index_appointments_pending_expires_at")
      t.check_constraint("jsonb_typeof(snapshot) = 'object'", name: "appointments_snapshot_is_object")
      t.check_constraint("decided_by IS NULL OR decided_by IN ('owner', 'timeout', 'client')", name: "appointments_decided_by_known")
      t.check_constraint("cancelled_by IS NULL OR cancelled_by IN ('owner', 'client', 'system')", name: "appointments_cancelled_by_known")
    end

    create_table(:appointment_tokens) do |t|
      t.references(:appointment, null: false, foreign_key: { on_delete: :cascade })
      t.string(:purpose, null: false)
      t.string(:digest, null: false)
      t.datetime(:expires_at, null: false)
      t.datetime(:used_at)
      t.datetime(:created_at, null: false)
      t.index([:digest], unique: true)
      t.check_constraint("purpose IN ('manage', 'approve', 'decline')", name: "appointment_tokens_purpose_known")
    end
  end
end
