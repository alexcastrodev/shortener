class AddRemindersSentToAppointments < ActiveRecord::Migration[8.1]
  def up
    add_column :appointments, :reminders_sent, :integer, array: true, default: [], null: false
    execute("UPDATE appointments SET reminders_sent = ARRAY[1440] WHERE reminder_sent_at IS NOT NULL")
  end

  def down
    remove_column :appointments, :reminders_sent
  end
end
