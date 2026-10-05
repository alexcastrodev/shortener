class AddPartialIndexesForIpRetention < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_index(:events, :clicked_at, where: "ip_address IS NOT NULL", name: "index_events_ip_retention", algorithm: :concurrently)
    add_index(:page_link_clicks, :clicked_at, where: "ip_address IS NOT NULL", name: "index_page_link_clicks_ip_retention", algorithm: :concurrently)
    add_index(:audits, :created_at, where: "remote_address IS NOT NULL", name: "index_audits_ip_retention", algorithm: :concurrently)
  end
end
