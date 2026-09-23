# Clicks are written synchronously: unlike shortlink redirects (edge function
# -> RabbitMQ -> AnalyticsWorker), nothing waits on this request, so a queue
# would add a moving part without removing any latency from the user.
class Api::Public::PageLinkClicksController < ApplicationController
  include ClientIp

  DEDUP_WINDOW = 10.seconds

  rate_limit to: 30,
    within: 1.minute,
    name: "public_page_link_clicks",
    by: -> { client_ip },
    with: -> { head(:too_many_requests) }

  # POST /api/public/pages/:slug/links/:page_link_id/click
  def create
    page = Page.visible.find_by!(slug: params[:slug].to_s.downcase)
    link = page.page_links.visible.clickable.find(params[:page_link_id])

    record_click(link) unless duplicate_click?(link)

    head(:no_content)
  end

  private

  # The same visitor hitting the same link twice in a few seconds (double
  # tap, replay) counts once.
  def duplicate_click?(link)
    key = "page_link_click:#{link.id}:#{client_ip}"
    !Rails.cache.write(key, 1, expires_in: DEDUP_WINDOW, unless_exist: true)
  end

  def record_click(link)
    user_agent = request.user_agent.to_s

    link.page_link_clicks.create!(
      ip_address: client_ip,
      user_agent: user_agent.first(255),
      referer: params[:referer].to_s.first(255).presence,
      country_code: country_code,
      region: request.headers["CF-Region"].to_s.strip.first(255).presence,
      platform: UserAgentParser.platform(user_agent),
      browser: UserAgentParser.browser(user_agent),
    )
  end

  # cf-ipcountry: XX = unknown location, T1 = Tor exit node.
  def country_code
    country = request.headers["CF-IPCountry"].to_s.strip.upcase
    country.presence unless ["XX", "T1"].include?(country)
  end
end
