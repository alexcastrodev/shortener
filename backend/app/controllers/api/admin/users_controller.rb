class Api::Admin::UsersController < ApplicationController
  before_action :authenticate_user!

  def index
    authorize(@current_user, :list_all?)

    render(json: UserSerializer.new(User.all.order(id: :desc)).serialize, status: :ok)
  end
end
