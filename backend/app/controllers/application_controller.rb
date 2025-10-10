class ApplicationController < ActionController::API
  before_action :authenticate_user!

  rescue_from ::ActiveRecord::RecordNotFound, with: :record_not_found
  rescue_from ::ActiveRecord::RecordNotDestroyed, with: :record_not_destroyed
  rescue_from ::ActiveRecord::RecordInvalid, with: :record_invalid

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

  def authenticate_user!
    auth_header = request.headers["Authorization"]
    return render(json: { message: "Missing token" }, status: :unauthorized) unless auth_header

    token = auth_header.split(" ").last
    decoded = JWT.decode(token, Rails.application.secret_key_base, true, algorithm: "HS256")
    user_id = decoded.first["sub"]
    @current_user = User.find(user_id)
  rescue JWT::ExpiredSignature, JWT::DecodeError
    render(json: { message: "Invalid or expired token" }, status: :unauthorized)
  end
end
