class Api::Me::UsersController < ApplicationController
  def show
    render json: { id: current_user.id, email: current_user.email }
  end
end
