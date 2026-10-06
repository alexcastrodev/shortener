class CreateWaitlistEntries < ActiveRecord::Migration[8.1]
  def change
    add_column :appointment_slots, :held, :integer, default: 0, null: false
    remove_check_constraint :appointment_slots, name: "appointment_slots_booked_within_capacity"
    add_check_constraint :appointment_slots, "capacity IS NULL OR booked + held <= capacity", name: "appointment_slots_taken_within_capacity"
    add_check_constraint :appointment_slots, "held >= 0", name: "appointment_slots_held_non_negative"

    create_table :waitlist_entries do |t|
      t.references :form, null: false, foreign_key: true
      t.string :service_key, null: false
      t.datetime :starts_at, null: false
      t.string :name, null: false, limit: 100
      t.string :email, null: false, limit: 254
      t.string :locale
      t.string :time_zone
      t.string :status, null: false, default: "waiting"
      t.datetime :offered_until
      t.timestamps
    end
    add_index :waitlist_entries, [:form_id, :service_key, :starts_at, :status], name: "index_waitlist_entries_queue"
    add_index :waitlist_entries, [:status, :offered_until], name: "index_waitlist_entries_offers", where: "status = 'offered'"
    add_index :waitlist_entries, "form_id, service_key, starts_at, lower(email)", unique: true, where: "status IN ('waiting', 'offered')", name: "index_waitlist_entries_one_per_email"
    add_check_constraint :waitlist_entries, "status IN ('waiting', 'offered', 'claimed', 'expired', 'left')", name: "waitlist_entries_status_known"
  end
end
