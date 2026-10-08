class IndexAppointmentsClientEmail < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_index(:appointments, "lower(client_email)", name: "index_appointments_on_lower_client_email", algorithm: :concurrently)
  end
end
