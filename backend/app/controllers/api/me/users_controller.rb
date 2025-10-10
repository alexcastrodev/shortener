class Api::Me::UsersController < ApplicationController
  def show
    render(json: UserSerializer.new(current_user).serialize, status: :ok)
  end
end
