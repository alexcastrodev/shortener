# Rechecks every bio page link against Safe Browsing, in batches of the most
# URLs the API accepts per request.
class RecheckPageLinksSafetyJob < ApplicationJob
  queue_as :safety

  RECHECK_AFTER = 1.day

  def perform
    return if ENV["ENABLE_GOOGLE_SAFE_LINK"].blank?

    PageLink
      .where.not(url: nil)
      .merge(PageLink.where(safe_checked_at: nil).or(PageLink.where(safe_checked_at: ...RECHECK_AFTER.ago)))
      .in_batches(of: GoogleLib::SafeBrowsing::V4::Services::MAX_BATCH) do |batch|
        PageLinkSafetyJob.perform_later(batch.ids)
      end
  end
end
