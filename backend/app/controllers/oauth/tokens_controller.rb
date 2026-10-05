class Oauth::TokensController < Oauth::BaseController
  VERIFIER = /\A[A-Za-z0-9\-._~]{43,128}\z/

  before_action :require_form_encoded

  rate_limit to: 60,
    within: 1.minute,
    name: "oauth_token",
    by: -> { params[:client_id].to_s.first(64) },
    with: -> { oauth_error("temporarily_unavailable", "Too many requests", status: :too_many_requests) }

  def create
    case params[:grant_type]
    when "authorization_code" then authorization_code
    when "refresh_token" then refresh
    else oauth_error("unsupported_grant_type")
    end
  end

  private

  def authorization_code
    code = OauthAuthorizationCode.redeem(params[:code])
    return invalid_grant unless code

    grant = code.oauth_grant
    return invalid_grant unless usable?(grant) && grant.oauth_client.client_id == params[:client_id].to_s
    return invalid_grant unless code.redirect_uri == params[:redirect_uri].to_s
    return invalid_grant unless pkce_valid?(code.code_challenge, params[:code_verifier])
    return oauth_error("invalid_target", "Unknown resource") if params[:resource].present? && params[:resource] != grant.resource

    issue(grant, OauthRefreshToken.issue(grant))
  end

  def refresh
    token = OauthRefreshToken.rotate(params[:refresh_token])
    return invalid_grant unless token

    grant = token.oauth_grant
    return invalid_grant unless usable?(grant) && grant.oauth_client.client_id == params[:client_id].to_s

    requested = params[:scope].to_s.split
    return oauth_error("invalid_scope", "Scopes cannot be widened") unless (requested - grant.scopes).empty?

    issue(grant, OauthRefreshToken.issue(grant, absolute_expires_at: token.absolute_expires_at))
  end

  def usable?(grant)
    grant.active? && grant.user.active? && grant.user.session_current?(grant.created_at.to_i)
  end

  def pkce_valid?(challenge, verifier)
    return false unless verifier.is_a?(String) && verifier.match?(VERIFIER)

    expected = Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(verifier), padding: false)
    ActiveSupport::SecurityUtils.secure_compare(expected, challenge)
  end

  def issue(grant, refresh_token)
    raw, ttl = OauthAccessToken.issue(grant)
    grant.update_column(:last_used_at, Time.current)
    render(json: { access_token: raw, token_type: "Bearer", expires_in: ttl, refresh_token: refresh_token, scope: grant.scopes.join(" ") })
  end

  def invalid_grant
    oauth_error("invalid_grant")
  end
end
