class Api::Admin::AuditsController < ApplicationController
  before_action :authenticate_user!

  # GET /api/admin/audits
  def index
    authorize(:audit, :list_all?)

    audits = Admin::AuditSearchService.call(user_id: params[:user_id])

    render(json: AuditSerializer.new(audits.includes(:user)).serialize(meta: { total: Audited::Audit.count }), status: :ok)
  end
end
