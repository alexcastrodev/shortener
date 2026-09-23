class PageLinkSafetyJob < ApplicationJob
  queue_as :safety

  # A failed Safe Browsing request leaves links as they were; the next
  # periodic recheck tries again. Hiding every link on a transient API error
  # would take down pages that did nothing wrong.
  retry_on GoogleLib::SafeBrowsing::V4::Services::Error, wait: :polynomially_longer, attempts: 3

  def perform(page_link_ids)
    links = PageLink.where(id: page_link_ids).where.not(url: nil).to_a
    return if links.empty?

    unsafe = GoogleLib::SafeBrowsing::V4::Services.unsafe_urls(links.map(&:url).uniq)
    flagged, clean = links.partition { |link| unsafe.include?(link.url) }
    now = Time.current

    PageLink.where(id: flagged.map(&:id)).update_all(safe: false, safe_checked_at: now) if flagged.any?
    PageLink.where(id: clean.map(&:id)).update_all(safe: true, safe_checked_at: now) if clean.any?
    Rails.logger.warn("[PageLinkSafetyJob] Flagged page links: #{flagged.map(&:id)}") if flagged.any?
  end
end
