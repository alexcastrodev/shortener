module Oauth
  module Config
    extend self

    def enabled?
      ENV["MCP_ENABLED"] == "true"
    end

    def issuer
      ENV.fetch("OAUTH_ISSUER", "https://api.kurz.fyi")
    end

    def resource
      "#{issuer}/mcp"
    end

    def authorization_endpoint
      "#{ENV.fetch("FRONTEND_URL", "https://kurz.fyi")}/oauth/authorize"
    end

    def scopes
      OauthGrant::SCOPES
    end
  end
end
