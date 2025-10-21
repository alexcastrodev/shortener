class Api::Admin::ShortlinksController < ApplicationController
  # GET /api/admin/shortlinks
  def index
    authorize(@current_user, :list_all?)

    render(json: ShortlinkSerializer.new(Shortlink.all.order(id: :desc), params: { admin: true }).serialize, status: :ok)
  end

  # POST /api/admin/shortlinks/:id/toggle_safe
  def toggle_safe
    shortlink = Shortlink.find(params[:id])
    authorize(shortlink, :modify_shortlink_safety?)

    shortlink.safe = !shortlink.safe
    shortlink.safe_checked_at = Time.current
    shortlink.save!

    render(json: ShortlinkSerializer.new(shortlink, params: { admin: true }).serialize, status: :ok)
  end
end
