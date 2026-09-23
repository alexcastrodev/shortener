# Flags campaigns: several brand-new accounts publishing the same page (same
# text, or the same set of links) within a day. It only raises signals for
# an admin to review; it never takes anything down on its own.
class DetectPageAbuseJob < ApplicationJob
  queue_as :default

  WINDOW = 24.hours
  NEW_ACCOUNT_AGE = 7.days
  MIN_USERS = 3
  MIN_TEXT_LENGTH = 20

  def perform
    pages = Page.joins(:user)
      .where(created_at: WINDOW.ago..)
      .where(users: { created_at: NEW_ACCOUNT_AGE.ago.. })
      .includes(:page_links)
      .to_a

    groups = Hash.new { |hash, key| hash[key] = [] }
    pages.each do |page|
      if (text = text_fingerprint(page))
        groups[["same_text", text]] << page
      end
      if (links = links_fingerprint(page))
        groups[["same_links", links]] << page
      end
    end

    groups.each do |(kind, fingerprint), group|
      next if group.map(&:user_id).uniq.size < MIN_USERS

      record(kind, fingerprint, group)
    end
  end

  private

  def text_fingerprint(page)
    text = [page.display_title, page.bio].join(" ").downcase.gsub(/\s+/, " ").strip
    return if text.length < MIN_TEXT_LENGTH

    Digest::SHA256.hexdigest(text)
  end

  def links_fingerprint(page)
    urls = page.page_links
      .filter_map { |link| link.url.to_s.strip.downcase.chomp("/").presence }
      .reject { |url| placeholder?(url) }
      .uniq.sort
    return if urls.empty?

    Digest::SHA256.hexdigest(urls.join("\n"))
  end

  def placeholder?(url)
    url == BuiltInPageTemplates::PLACEHOLDER.downcase.chomp("/") ||
      PageLink::NETWORKS.values.any? { |network| url == network[:placeholder].downcase.chomp("/") }
  end

  def record(kind, fingerprint, group)
    now = Time.current
    signal = AbuseSignal.find_or_initialize_by(kind: kind, fingerprint: fingerprint)
    created = signal.new_record?
    signal.assign_attributes(
      user_ids: (Array(signal.user_ids) | group.map(&:user_id)).sort,
      page_ids: (Array(signal.page_ids) | group.map(&:id)).sort,
      first_seen_at: signal.first_seen_at || now,
      last_seen_at: now,
    )
    signal.save!

    return unless created

    Sentry.capture_message(
      "Possible abuse campaign: #{group.map(&:user_id).uniq.size} new accounts with #{kind.tr("_", " ")}",
      level: :warning,
      extra: { abuse_signal_id: signal.id, page_ids: signal.page_ids },
    )
  end
end
