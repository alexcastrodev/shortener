class SafetyUrlJob < ApplicationJob
  queue_as :default

  def perform(shortlink_id)
    shortlink = Shortlink.find_by(id: shortlink_id)
    Rails.logger.info("[SafetyUrlJob]: Checking URL safety for Shortlink ID: #{shortlink_id}")
    return if shortlink.nil?

    # 1. Basically, if the URL is not safe, we remove from cache.
    # It will avoid people to be redirected. (We can reactive it later if needed)
    # 2. If the URL is safe, we mark as verified.
    is_safe = GoogleLib::SafeBrowsing::V4::Services.check_url(shortlink.original_url)

    if is_safe
      shortlink.mark_as_safe!
    else
      shortlink.mark_as_dangerous!
    end
  end
end
