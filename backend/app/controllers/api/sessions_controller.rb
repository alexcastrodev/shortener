class Api::SessionsController < ApplicationController
  skip_before_action :authenticate_user!, only: [:create, :verify]

  # POST /api/login_request
  def create
    if params[:email].present?
      user = User.find_or_create_by(email: params[:email])
      user.generate_login_token!
      LoginMailer.with(user:).magic_link.deliver_later
      render json: { message: "If the email exists, the link has been sent." }
    else
      render json: { error: "Email is required" }, status: :unprocessable_entity
    end
  end

  # POST /api/login_verify
  def verify
    user = User.find_by(login_token: params[:token])

    if user&.login_token_valid?
      token = generate_jwt(user)
      user.clear_login_token!
      render json: { jwt: token, user: { id: user.id, email: user.email } }
    else
      render json: { error: "Token invalid or expired" }, status: :unauthorized
    end
  end

  private

  def generate_jwt(user)
    payload = { sub: user.id, exp: 1.hour.from_now.to_i }
    JWT.encode(payload, Rails.application.secret_key_base, 'HS256')
  end
end
