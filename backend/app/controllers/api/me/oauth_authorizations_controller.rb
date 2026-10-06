class Api::Me::OauthAuthorizationsController < ApplicationController
  before_action :require_enabled
  before_action :authenticate_user!

  rate_limit to: 30,
    within: 1.minute,
    name: "oauth_authorize",
    by: -> { current_user&.id },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  def show
    request_data = Oauth::AuthorizationRequest.new(authorization_params)
    return render_failure(request_data) unless request_data.valid?

    render(json: {
      client: { name: request_data.client.client_name, redirect_host: URI.parse(request_data.redirect_uri).host },
      scopes: request_data.scopes,
      email: current_user.email,
      resource: request_data.resource,
    })
  end

  def create
    request_data = Oauth::AuthorizationRequest.new(authorization_params)
    return render_failure(request_data) unless request_data.valid?
    return render(json: { redirect_to: request_data.redirect_url(error: "access_denied") }) unless params[:decision] == "allow"

    granted = Array(params[:granted_scopes]).map(&:to_s).uniq & request_data.scopes
    granted = [OauthGrant::FULL_SCOPE] if granted.include?(OauthGrant::FULL_SCOPE)
    return render(json: { redirect_to: request_data.redirect_url(error: "access_denied") }) if granted.empty?

    if granted.intersect?(OauthGrant::PERSONAL_DATA_SCOPES) && granted.intersect?(OauthGrant::PUBLISH_SCOPES)
      return render(json: { error: "conflicting_scopes", message: "Reading personal data cannot be combined with publishing" }, status: :unprocessable_content)
    end

    grant = OauthGrant.create!(user: current_user, oauth_client: request_data.client, scopes: granted, resource: request_data.resource)
    code = OauthAuthorizationCode.issue(grant: grant, code_challenge: request_data.code_challenge, redirect_uri: request_data.redirect_uri)
    render(json: { redirect_to: request_data.redirect_url(code: code) })
  end

  private

  def require_enabled
    head(:not_found) unless Oauth::Config.enabled?
  end

  def authorization_params
    params.permit(:client_id, :redirect_uri, :response_type, :code_challenge, :code_challenge_method, :scope, :resource, :state)
  end

  def render_failure(request_data)
    if request_data.redirectable
      render(json: { error: request_data.error, redirect_to: request_data.redirect_url(error: request_data.error) }, status: :bad_request)
    else
      render(json: { error: request_data.error }, status: :bad_request)
    end
  end
end
