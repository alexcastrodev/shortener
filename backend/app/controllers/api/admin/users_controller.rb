class Api::Admin::UsersController < ApplicationController
  before_action :authenticate_user!

  def index
    authorize(@current_user, :list_all?)

    users = Admin::UserSearchService.call(status: params[:status], q: params[:q])

    render(json: UserSerializer.new(users).serialize(meta: { total: User.count }), status: :ok)
  end

  # POST /api/admin/users/:id/toggle_active
  def toggle_active
    user = User.find(params[:id])
    authorize(user, :toggle_active?)

    if user.active?
      user.deactivate!
    else
      user.reactivate!
    end

    render(json: UserSerializer.new(user).serialize, status: :ok)
  end
end
