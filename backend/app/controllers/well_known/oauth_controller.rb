class WellKnown::OauthController < Oauth::BaseController
  def protected_resource
    render(json: {
      resource: Oauth::Config.resource,
      authorization_servers: [Oauth::Config.issuer],
      scopes_supported: Oauth::Config.scopes,
      bearer_methods_supported: ["header"],
    })
  end

  def authorization_server
    issuer = Oauth::Config.issuer
    render(json: {
      issuer: issuer,
      authorization_endpoint: Oauth::Config.authorization_endpoint,
      token_endpoint: "#{issuer}/oauth/token",
      registration_endpoint: "#{issuer}/oauth/register",
      revocation_endpoint: "#{issuer}/oauth/revoke",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      scopes_supported: Oauth::Config.scopes,
      authorization_response_iss_parameter_supported: true,
    })
  end
end
