class Api::Admin::ShortlinksController < ApplicationController
  before_action :authenticate_user!

  # GET /api/admin/shortlinks
  def index
    authorize(Shortlink, :list_all?)
    shortlinks = Shortlink.all.includes(:user).order(id: :desc)
    render(json: ShortlinkSerializer.new(shortlinks, params: { admin: true }).serialize, status: :ok)
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

  # POST /api/admin/shortlinks/:id/toggle_active
  def toggle_active
    shortlink = Shortlink.find(params[:id])
    authorize(shortlink, :modify_shortlink_active?)

    if shortlink.inactive_at.nil?
      shortlink.remove_cache
      shortlink.update!(inactive_at: Time.current)
    else
      shortlink.save_cache if shortlink.safe?
      shortlink.update!(inactive_at: nil)
    end

    render(json: ShortlinkSerializer.new(shortlink, params: { admin: true }).serialize, status: :ok)
  end
end
