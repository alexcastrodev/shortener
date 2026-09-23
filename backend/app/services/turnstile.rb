# Cloudflare Turnstile check for the sign-in form. Off until
# TURNSTILE_SECRET_KEY is set. A token passes only if Cloudflare says so, it
# was issued for this form's action and, when TURNSTILE_HOSTNAMES is set, on
# one of our hostnames (so a token solved on another site is useless here).
# Tokens are single use; Cloudflare rejects replays.
#
# If Cloudflare cannot be reached the request is let through: the per-IP
# limits and MailBudget still apply, and a Turnstile outage should not lock
# everyone out.
module Turnstile
  extend self

  VERIFY_URL = URI("https://challenges.cloudflare.com/turnstile/v0/siteverify")

  def enabled?
    secret.present?
  end

  def valid?(token, action:, remote_ip:)
    return true unless enabled?
    return false if token.blank?

    result = verify(token, remote_ip)
    return result["success"] == true if testing_key?(result)

    result["success"] == true && result["action"] == action && hostname_allowed?(result["hostname"])
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED, JSON::ParserError => e
    Rails.logger.warn("[Turnstile] verification skipped: #{e.class}")
    true
  end

  private

  def verify(token, remote_ip)
    http = Net::HTTP.new(VERIFY_URL.host, VERIFY_URL.port)
    http.use_ssl = true
    http.open_timeout = 3
    http.read_timeout = 5
    request = Net::HTTP::Post.new(VERIFY_URL)
    request.set_form_data(secret: secret, response: token.to_s.first(2048), remoteip: remote_ip)
    JSON.parse(http.request(request).body)
  end

  # Cloudflare's test keys (used locally) answer without an action and with
  # hostname "example.com". Never trusted in production, where the real
  # secret is set.
  def testing_key?(result)
    !Rails.env.production? && result.dig("metadata", "result_with_testing_key") == true
  end

  def hostname_allowed?(hostname)
    allowed = ENV["TURNSTILE_HOSTNAMES"].to_s.split(",").map(&:strip).reject(&:empty?)
    allowed.empty? || allowed.include?(hostname)
  end

  def secret
    ENV["TURNSTILE_SECRET_KEY"]
  end
end
