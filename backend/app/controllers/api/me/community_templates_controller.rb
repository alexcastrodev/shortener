# The Community gallery: other people's published templates, always as
# placeholders (see PageTemplate#public_items).
class Api::Me::CommunityTemplatesController < ApplicationController
  include PageTemplateLookup

  before_action :authenticate_user!

  rate_limit to: 20,
    within: 1.hour,
    only: :report,
    name: "community_template_report",
    by: -> { current_user&.id },
    with: -> { render(json: { error: "Too many reports, please try again later" }, status: :too_many_requests) }

  # GET /api/me/community_templates?page=1&per_page=12&sort=popular|new
  def index
    page = [params.fetch(:page, 1).to_i, 1].max
    per_page = params.fetch(:per_page, 12).to_i.clamp(1, 48)

    templates = PageTemplate.listed
    templates = params[:sort] == "new" ? templates.order(published_at: :desc, id: :desc) : templates.order(uses_count: :desc, published_at: :desc)
    total = templates.count
    templates = templates.offset((page - 1) * per_page).limit(per_page).to_a

    author_slugs = visible_author_slugs(templates)
    render(
      json: {
        page_template: templates.map { |template| serialize_community(template, author_slugs: author_slugs) },
        meta: { total: total, page: page, per_page: per_page },
      },
      status: :ok,
    )
  end

  # POST /api/me/community_templates/:id/report  { reason }
  def report
    template = PageTemplate.listed.find(params[:id].to_s.delete_prefix(COMMUNITY_PREFIX))

    validate_contract(PageTemplateReportContract) do |validated_params|
      template.report!(user: @current_user, reason: validated_params[:reason])
      head(:no_content)
    end
  rescue ActiveRecord::RecordInvalid => e
    render(json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity)
  end
end
