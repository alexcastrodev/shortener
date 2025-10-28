class Api::Admin::ShortlinksController < ApplicationController
  before_action :authenticate_user!

  # GET /api/admin/shortlinks
  def index
    authorize(Shortlink, :list_all?)

    render(json: ShortlinkSerializer.new(Shortlink.all.order(id: :desc), params: { admin: true }).serialize, status: :ok)
  end

  # POST /api/admin/shortlinks/:id/toggle_safe
  def toggle_safe
    shortlink = Shortlink.find(params[:id])
    authorize(shortlink, :modify_shortlink_safety?)

    if shortlink.safe?
      shortlink.mark_as_dangerous!
    else
      shortlink.mark_as_safe!
    end

    render(json: ShortlinkSerializer.new(shortlink, params: { admin: true }).serialize, status: :ok)
  end
end
