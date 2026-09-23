# Shrinks a raw avatar upload (up to 50MB, e.g. a full-resolution HEIC) to
# a WebP of at most Page::AVATAR_MAX_EDGE px, swaps it in as the page's
# avatar, deletes the original and renders :thumb, so no visitor ever pays
# for a decode.
#
# Runs on the "images" queue, which has a single worker thread: at most one
# decode at a time across the cluster, so a burst of uploads waits in line
# instead of exhausting the jobs container's memory or delaying other
# queues. limits_concurrency keeps one user from lining up several of their
# own uploads ahead of everyone else.
class OptimizeAvatarJob < ApplicationJob
  queue_as :images

  limits_concurrency to: 1,
    key: ->(page_id, _blob_id) { Page.with_deleted.where(id: page_id).pick(:user_id) || "page-#{page_id}" },
    duration: 5.minutes

  # The upload was purged (replaced or removed) before the job got to it.
  discard_on ActiveStorage::FileNotFoundError

  def perform(page_id, blob_id)
    page = Page.find_by(id: page_id)
    # Replaced by a newer upload, or the avatar was removed meanwhile.
    return unless page && current_upload?(page, blob_id)

    optimized = optimize(page.avatar_upload.blob)

    page.with_lock do
      next unless current_upload?(page, blob_id)

      page.avatar.attach(io: optimized, filename: "avatar.webp", content_type: "image/webp")
      page.avatar_upload.purge_later
    end

    page.avatar.variant(:thumb).processed if page.avatar.attached?
  rescue Vips::Error => e
    # Deterministic: retrying the same file fails the same way. Drop the
    # upload and keep whatever avatar the page had.
    Rails.logger.warn("[OptimizeAvatarJob] Could not process blob #{blob_id} for page #{page_id}: #{e.message}")
    page.avatar_upload.purge_later if page && current_upload?(page, blob_id)
  ensure
    optimized&.close!
  end

  private

  def current_upload?(page, blob_id)
    page.reload.avatar_upload.attached? && page.avatar_upload.blob_id == blob_id
  end

  # thumbnail shrinks on load and autorotates from EXIF; strip drops the
  # EXIF block (GPS included). fail: raise on a truncated or corrupt file
  # instead of producing a half-decoded image.
  def optimize(blob)
    blob.open do |file|
      ImageProcessing::Vips
        .source(file)
        .loader(fail: true)
        .resize_to_limit(Page::AVATAR_MAX_EDGE, Page::AVATAR_MAX_EDGE)
        .convert("webp")
        .saver(quality: 85, strip: true)
        .call
    end
  end
end
