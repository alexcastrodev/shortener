class Api::Me::UsersController < ApplicationController
  before_action :authenticate_user!

  def show
    render(json: UserSerializer.new(current_user).serialize, status: :ok)
  end
end
