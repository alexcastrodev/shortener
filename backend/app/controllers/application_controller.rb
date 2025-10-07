class ApplicationController < ActionController::API
  before_action :authenticate_user!

  attr_reader :current_user

  private

  def authenticate_user!
    auth_header = request.headers["Authorization"]
    return render json: { error: "Missing token" }, status: :unauthorized unless auth_header

    token = auth_header.split(" ").last
    decoded = JWT.decode(token, Rails.application.secret_key_base, true, algorithm: "HS256")
    user_id = decoded.first["sub"]
    @current_user = User.find(user_id)
  rescue JWT::ExpiredSignature, JWT::DecodeError
    render json: { error: "Invalid or expired token" }, status: :unauthorized
  end
end
