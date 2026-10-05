class Mcp::EndpointController < ActionController::API
  before_action :require_enabled
  before_action :authenticate

  rate_limit to: 120,
    within: 1.minute,
    name: "mcp_grant",
    by: -> { @grant&.id },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  def handle
    status, headers, body = Mcp::ServerFactory.call(grant: @grant, request: Rack::Request.new(request.env))
    headers.each { |name, value| response.set_header(name, value) }
    response.set_header("Cache-Control", "no-store")
    render(body: body.join, status: status, content_type: headers["content-type"] || "application/json")
  end

  private

  def require_enabled
    head(:not_found) unless Oauth::Config.enabled?
  end

  def authenticate
    @grant = grant_from_token
    return challenge if @grant.nil?

    @grant.update_column(:last_used_at, Time.current) if @grant.last_used_at.nil? || @grant.last_used_at < 1.minute.ago
  end

  def grant_from_token
    scheme, raw = request.headers["Authorization"].to_s.split(" ", 2)
    return unless scheme&.casecmp?("Bearer") && raw

    token = OauthAccessToken.authenticate(raw.strip)
    grant = token&.oauth_grant
    return unless grant&.active? && grant.resource == Oauth::Config.resource
    return unless grant.user.active? && grant.user.session_current?(grant.created_at.to_i) && beta_user?(grant.user)

    grant
  end

  def beta_user?(user)
    emails = ENV.fetch("MCP_BETA_EMAILS", "").split(",").map { |email| email.strip.downcase }.reject(&:empty?)
    emails.empty? || emails.include?(user.email.to_s.downcase)
  end

  def challenge
    metadata = "#{Oauth::Config.issuer}/.well-known/oauth-protected-resource/mcp"
    error = request.headers["Authorization"].present? ? %(error="invalid_token", ) : ""
    response.set_header("WWW-Authenticate", %(Bearer #{error}resource_metadata="#{metadata}", scope="#{Oauth::Config.scopes.join(" ")}"))
    response.set_header("Cache-Control", "no-store")
    head(:unauthorized)
  end
end
