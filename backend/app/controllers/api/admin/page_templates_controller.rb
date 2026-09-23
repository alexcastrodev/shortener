# Community moderation: reported and hidden templates. Admins see the
# originals too, since that is what gets judged.
class Api::Admin::PageTemplatesController < ApplicationController
  STATUSES = ["reported", "hidden", "public"].freeze

  before_action :authenticate_user!

  # GET /api/admin/page_templates?status=reported|hidden|public
  def index
    authorize(PageTemplate, :moderate?)

    templates = PageTemplate.where(visibility: "public").includes(:user, :author_page, :reports)
    templates =
      case params[:status]
      when "hidden" then templates.where.not(hidden_at: nil)
      when "public" then templates.where(hidden_at: nil)
      else templates.where("reports_count > 0 OR hidden_at IS NOT NULL")
      end
    templates = templates.order(reports_count: :desc, published_at: :desc).limit(200)

    render(json: { page_template: templates.map { |template| serialize(template) } }, status: :ok)
  end

  # POST /api/admin/page_templates/:id/toggle_hidden
  # Unhiding clears the reports: the template starts over.
  def toggle_hidden
    template = PageTemplate.where(visibility: "public").find(params[:id])
    authorize(template, :moderate?)

    template.toggle_hidden!
    render(json: { page_template: serialize(template.reload) }, status: :ok)
  end

  private

  def serialize(template)
    {
      "id" => template.id,
      "name" => template.name,
      "description" => template.description,
      "theme" => template.theme,
      "items" => template.items,
      "public_items" => template.public_items,
      "author_label" => template.author_label,
      "author_slug" => template.author_page&.slug,
      "owner_email" => template.user.email,
      "owner_id" => template.user_id,
      "uses_count" => template.uses_count,
      "reports_count" => template.reports_count,
      "reasons" => template.reports.map(&:reason).tally,
      "hidden" => template.hidden_at.present?,
      "published_at" => template.published_at,
    }
  end
end
