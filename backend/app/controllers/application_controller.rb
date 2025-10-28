class ApplicationController < ActionController::API
  include Pundit::Authorization

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

  def authenticate_user
    auth_header = request.headers["Authorization"]
    return if auth_header.blank?

    @current_user = User.find_by(id: jwt_user_id(auth_header))
  end

  def authenticate_user!
    auth_header = request.headers["Authorization"]
    return render(json: { message: "Missing token" }, status: :unauthorized) unless auth_header

    @current_user = User.find(jwt_user_id(auth_header))
  rescue JWT::ExpiredSignature, JWT::DecodeError
    render(json: { message: "Invalid or expired token" }, status: :unauthorized)
  end

  def jwt_user_id(auth_header)
    token = auth_header.split(" ").last
    decoded = JWT.decode(token, Rails.application.secret_key_base, true, algorithm: "HS256")
    decoded.first["sub"]
  end
end
