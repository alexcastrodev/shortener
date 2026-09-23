# Drops raw avatar uploads that OptimizeAvatarJob never got to (job lost,
# worker down for long). Frees the bucket from 50MB originals and takes the
# editor out of "processing"; the page keeps its previous avatar.
class CleanupStaleAvatarUploadsJob < ApplicationJob
  queue_as :default

  STALE_AFTER = 1.hour

  def perform
    ActiveStorage::Attachment
      .where(record_type: "Page", name: "avatar_upload")
      .where(created_at: ...STALE_AFTER.ago)
      .find_each(&:purge_later)
  end
end
