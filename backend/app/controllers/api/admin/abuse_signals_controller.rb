# Signals raised by DetectPageAbuseJob. Deactivating an owner goes through
# the existing POST /api/admin/users/:id/toggle_active.
class Api::Admin::AbuseSignalsController < ApplicationController
  before_action :authenticate_user!

  # GET /api/admin/abuse_signals?status=open|dismissed
  def index
    authorize(AbuseSignal, :moderate?)

    status = AbuseSignal::STATUSES.include?(params[:status]) ? params[:status] : "open"
    signals = AbuseSignal.where(status: status).order(last_seen_at: :desc).limit(100).to_a

    users = User.where(id: signals.flat_map(&:user_ids)).index_by(&:id)
    pages = Page.with_deleted.where(id: signals.flat_map(&:page_ids)).index_by(&:id)

    render(json: { abuse_signal: signals.map { |signal| serialize(signal, users, pages) } }, status: :ok)
  end

  # POST /api/admin/abuse_signals/:id/dismiss
  def dismiss
    signal = AbuseSignal.find(params[:id])
    authorize(signal, :moderate?)

    signal.dismiss!
    head(:no_content)
  end

  private

  def serialize(signal, users, pages)
    {
      "id" => signal.id,
      "kind" => signal.kind,
      "status" => signal.status,
      "first_seen_at" => signal.first_seen_at,
      "last_seen_at" => signal.last_seen_at,
      "users" => signal.user_ids.filter_map { |id| users[id] }.map do |user|
        { "id" => user.id, "email" => user.email, "active" => user.active?, "created_at" => user.created_at }
      end,
      "pages" => signal.page_ids.filter_map { |id| pages[id] }.map do |page|
        {
          "id" => page.id,
          "slug" => page.slug,
          "display_title" => page.display_title,
          "user_id" => page.user_id,
          "published" => page.published,
          "deleted" => page.deleted_at.present?,
        }
      end,
    }
  end
end
