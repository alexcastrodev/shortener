class PurgeOldIpAddressesJob < ApplicationJob
  queue_as :default

  RETENTION = 90.days
  BATCH = 5_000

  TARGETS = [
    [Event, [:ip_address, :user_agent, :referer], :clicked_at],
    [PageLinkClick, [:ip_address, :user_agent, :referer], :clicked_at],
    [Audited::Audit, [:remote_address], :created_at],
  ].freeze

  def perform
    cutoff = RETENTION.ago
    TARGETS.each do |model, columns, time_column|
      stale = model.where(time_column => ...cutoff).where(columns.map { |column| "#{model.quoted_table_name}.#{column} IS NOT NULL" }.join(" OR "))
      stale.in_batches(of: BATCH) { |batch| batch.update_all(columns.index_with { nil }) }
    end
  end
end
