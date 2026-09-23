# Where a bio page visitor came from. In-app browsers (Instagram, TikTok…)
# usually send no referer, but they do name themselves in the user agent, so
# that is checked first; the referer's host is the fallback.
module TrafficSource
  extend self

  USER_AGENTS = {
    "Instagram" => /Instagram/,
    "TikTok" => /musical_ly|BytedanceWebview|TikTok/i,
    "Facebook" => /FBAN|FBAV|FB_IAB/,
    "LinkedIn" => /LinkedInApp/,
    "Snapchat" => /Snapchat/,
    "X" => /Twitter/,
    "WhatsApp" => /WhatsApp/,
  }.freeze

  HOSTS = {
    "Instagram" => ["instagram.com"],
    "TikTok" => ["tiktok.com"],
    "Facebook" => ["facebook.com", "fb.com", "fb.me"],
    "LinkedIn" => ["linkedin.com", "lnkd.in"],
    "Snapchat" => ["snapchat.com"],
    "X" => ["x.com", "twitter.com", "t.co"],
    "YouTube" => ["youtube.com", "youtu.be"],
    "WhatsApp" => ["whatsapp.com", "wa.me"],
    "Google" => ["google."],
    "Kurz" => ["kurz.fyi"],
  }.freeze

  DIRECT = "Direct"
  OTHER = "Other"

  def call(user_agent:, referer:)
    app = in_app(user_agent)
    return app if app

    host = host_of(referer)
    return DIRECT if host.nil?

    HOSTS.each do |name, domains|
      return name if domains.any? { |domain| domain.end_with?(".") ? host.include?(domain) : host == domain || host.end_with?(".#{domain}") }
    end
    OTHER
  end

  # The app whose built-in browser made the request, if any.
  def in_app(user_agent)
    user_agent = user_agent.to_s
    USER_AGENTS.each { |name, pattern| return name if user_agent.match?(pattern) }
    nil
  end

  private

  def host_of(referer)
    return if referer.blank?

    URI.parse(referer.to_s).host&.downcase&.delete_prefix("www.")
  rescue URI::InvalidURIError
    nil
  end
end
