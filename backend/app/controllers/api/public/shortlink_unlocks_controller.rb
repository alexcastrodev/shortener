# Password-protected shortlinks are never resolved by the edge function: it
# sends visitors to /s/:short_code, whose form posts the password here.
class Api::Public::ShortlinkUnlocksController < ApplicationController
  include ClientIp

  # Keyed by link and IP: slows down guessing one link's password without
  # letting one visitor lock everybody else out of it.
  rate_limit to: 10,
    within: 5.minutes,
    only: :create,
    name: "shortlink_unlock",
    by: -> { "#{params[:short_code]}:#{client_ip}" },
    with: -> { render(json: { error: "Too many attempts, please try again later" }, status: :too_many_requests) }

  before_action :load_shortlink

  # GET /api/public/shortlinks/:short_code
  def show
    render(json: { short_code: @shortlink.short_code, locked: true }, status: :ok)
  end

  # POST /api/public/shortlinks/:short_code/unlock
  def create
    unless @shortlink.authenticate(params[:password].to_s)
      return render(json: { error: "Wrong password" }, status: :unauthorized)
    end

    record_click
    render(json: { original_url: @shortlink.original_url }, status: :ok)
  end

  private

  def load_shortlink
    @shortlink = Shortlink.find_by(short_code: params[:short_code].to_s)
    head(:not_found) unless @shortlink&.password_protected? && @shortlink.servable?
  end

  # Same data the edge function sends for regular redirects.
  def record_click
    user_agent = request.user_agent.to_s
    country = request.headers["CF-IPCountry"].to_s.strip.upcase

    Event.create!(
      shortlink: @shortlink,
      ip_address: client_ip,
      user_agent: user_agent.first(255),
      referer: params[:referer].to_s.first(255).presence,
      country_code: (country.presence unless ["XX", "T1"].include?(country)),
      region: request.headers["CF-Region"].to_s.strip.first(255).presence,
      platform: UserAgentParser.platform(user_agent),
      browser: UserAgentParser.browser(user_agent),
    )
  end
end
