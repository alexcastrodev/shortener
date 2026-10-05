class Oauth::RevocationsController < Oauth::BaseController
  before_action :require_form_encoded

  def create
    raw = params[:token].to_s
    digest = Oauth::Tokens.digest(raw)
    token = (OauthAccessToken.find_by(token_digest: digest) if Oauth::Tokens.kind?(raw, :access)) ||
      (OauthRefreshToken.find_by(token_digest: digest) if Oauth::Tokens.kind?(raw, :refresh))
    token&.oauth_grant&.revoke!
    head(:ok)
  end
end
