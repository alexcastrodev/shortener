class PurgeShortlinkJob < ApplicationJob
  queue_as :default

  BATCH_SIZE = 5_000

  # Permanently removes a soft-deleted shortlink and all of its events.
  # Events are deleted in batches so a link with thousands of events does not
  # lock the table or blow up memory in a single statement.
  def perform(shortlink_id)
    shortlink = Shortlink.with_deleted.find_by(id: shortlink_id)
    return unless shortlink&.deleted_at

    loop do
      deleted = Event.where(shortlink_id: shortlink_id).limit(BATCH_SIZE).delete_all
      break if deleted.zero?
    end

    shortlink.delete

    Rails.logger.info("[PurgeShortlinkJob]: purged shortlink_id=#{shortlink_id}")
  end
end
