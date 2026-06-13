class Api::SessionsController < ApplicationController
  # POST /api/login_request
  def create
    if params[:email].present?
      user = User.find_or_create_by(email: params[:email])
      user.send_magic_link

      render(json: { message: "If the email exists, the link has been sent." })
    else
      render(json: { error: "Email is required" }, status: :unprocessable_entity)
    end
  end

  # POST /api/login_verify
  def verify
    find_params = { email: params[:email], login_token: params[:code] }
    find_params.delete(:login_token) if dev_bypass?

    user = User.find_by(find_params)

    if user && (dev_bypass? || user.login_token_valid?)
      token = generate_jwt(user)
      user.clear_login_token!

      render(json: UserSerializer.new(user).serialize(meta: { token: token }), status: :ok)
    else
      render(json: { error: "Token invalid or expired" }, status: :unauthorized)
    end
  end

  private

  # Development-only bypass: accept the fixed code "0000000" so the magic-link
  # flow can be exercised locally without a real email round-trip.
  def dev_bypass?
    Rails.env.development? && params[:code] == "0000000"
  end

  def generate_jwt(user)
    payload = { sub: user.id, exp: 2.days.from_now.to_i }
    JWT.encode(payload, Rails.application.secret_key_base, "HS256")
  end
end
