class BackfillResourceKeyOfAppointmentSlots < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  class MigrationSlot < ActiveRecord::Base
    self.table_name = "appointment_slots"
  end

  def up
    MigrationSlot.where(resource_key: nil).in_batches(of: 5000) do |batch|
      batch.update_all("resource_key = service_key")
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
