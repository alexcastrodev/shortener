class PurgeOldIpAddressesJob < ApplicationJob
  queue_as :default

  RETENTION = 90.days
  BATCH = 5_000

  TARGETS = [
    [Event, :ip_address, :clicked_at],
    [PageLinkClick, :ip_address, :clicked_at],
    [Audited::Audit, :remote_address, :created_at],
  ].freeze

  def perform
    cutoff = RETENTION.ago
    TARGETS.each do |model, column, time_column|
      model.where.not(column => nil).where(time_column => ...cutoff).in_batches(of: BATCH) { |batch| batch.update_all(column => nil) }
    end
  end
end
