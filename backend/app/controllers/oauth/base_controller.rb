class Oauth::BaseController < ActionController::API
  before_action :require_enabled
  before_action :no_store

  private

  def require_enabled
    head(:not_found) unless Oauth::Config.enabled?
  end

  def no_store
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
  end

  def require_form_encoded
    head(:unsupported_media_type) unless request.media_type == "application/x-www-form-urlencoded"
  end

  def oauth_error(code, description = nil, status: :bad_request)
    render(json: { error: code, error_description: description }.compact, status: status)
  end
end
