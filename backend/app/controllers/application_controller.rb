class ApplicationController < ActionController::API
  include Pundit::Authorization
  include ActionController::Cookies
  # Lets models build Active Storage URLs (avatars) for the current host.
  include ActiveStorage::SetCurrent

  rescue_from ::ActiveRecord::RecordNotFound, with: :record_not_found
  rescue_from ::ActiveRecord::RecordNotDestroyed, with: :record_not_destroyed
  rescue_from ::ActiveRecord::RecordInvalid, with: :record_invalid
  rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized

  attr_reader :current_user

  def validate_contract(contract_class, context: nil)
    # Contract validation
    contract = contract_class.new.call(params.to_unsafe_h, context: context)
    if contract.errors.any?
      render(json: { errors: contract.errors.to_h }, status: :unprocessable_entity)
    elsif block_given?
      yield contract.to_h, params
    end
  end

  private

  def record_not_found(exception)
    render(json: { message: "Resource not found" }, status: :not_found)
  end

  def record_not_destroyed(exception)
    render(json: { message: "Resource could not be destroyed", details: exception.record.errors.full_messages }, status: :unprocessable_entity)
  end

  def record_invalid(exception)
    render(json: { message: "Resource is invalid", details: exception.record.errors.full_messages }, status: :unprocessable_entity)
  end

  def user_not_authorized
    render(json: { message: "You are not authorized to perform this action" }, status: :forbidden)
  end

  # SVGs are XML documents a browser can execute scripts in when opened
  # directly; the QR codes never contain any, and this keeps it that way.
  def svg_response_headers
    response.headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    response.headers["X-Content-Type-Options"] = "nosniff"
  end

  def authenticate_user!
    token = session_token
    return render(json: { message: "Missing token" }, status: :unauthorized) if token.blank?

    @session_payload = SessionToken.decode(token)
    return if cookie_session? && !csrf_safe?

    @current_user = User.find(@session_payload["sub"])

    if @current_user.deactivated?
      render(json: { message: I18n.t("errors.account_deactivated") }, status: :forbidden)
    end
  rescue JWT::DecodeError
    render(json: { message: "Invalid or expired token" }, status: :unauthorized)
  end

  # Browsers authenticate with the httpOnly session cookie; API clients (and
  # specs) may still send "Authorization: Bearer <token>".
  def session_token
    bearer_token || cookies[SessionCookie::NAME]
  end

  def bearer_token
    scheme, token = request.headers["Authorization"].to_s.split(" ", 2)
    token if scheme&.casecmp?("Bearer")
  end

  def cookie_session?
    bearer_token.blank?
  end

  # The cookie is SameSite=Strict and CORS only admits our origins; on top of
  # that, state-changing requests must carry a header that cross-site forms
  # cannot set and that forces a CORS preflight.
  def csrf_safe?
    return true if request.get? || request.head?
    return true if request.headers["X-Requested-With"] == "XMLHttpRequest"

    render(json: { message: "Missing X-Requested-With header" }, status: :forbidden)
    false
  end
end
