class Api::Me::OauthGrantsController < ApplicationController
  before_action :authenticate_user!

  def index
    grants = current_user.oauth_grants.active.includes(:oauth_client).order(created_at: :desc)
    render(json: { oauth_grant: grants.map { |grant| serialize(grant) } })
  end

  def destroy
    current_user.oauth_grants.active.find(params[:id]).revoke!
    head(:no_content)
  end

  private

  def serialize(grant)
    {
      id: grant.id,
      client_name: grant.oauth_client.client_name,
      redirect_host: URI.parse(grant.oauth_client.redirect_uris.first).host,
      scopes: grant.scopes,
      connected_at: grant.created_at.iso8601,
      last_used_at: grant.last_used_at&.iso8601,
    }
  end
end
