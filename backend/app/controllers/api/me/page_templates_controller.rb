class Api::Me::PageTemplatesController < ApplicationController
  include PageTemplateLookup

  before_action :authenticate_user!

  # Publishing is free but not unbounded: keeps the gallery from being
  # flooded from a single account.
  rate_limit to: 5,
    within: 1.day,
    only: :update,
    name: "page_template_publish",
    by: -> { current_user&.id },
    with: -> { render(json: { error: "Too many publications today, please try again tomorrow" }, status: :too_many_requests) }

  # GET /api/me/page_templates
  # Built-in templates first, then the ones this user saved (never anyone
  # else's).
  def index
    custom = @current_user.page_templates.order(created_at: :desc).map { |template| serialize_custom(template) }
    built_in = BuiltInPageTemplates.all.map { |template| template.merge("built_in" => true) }

    render(json: { page_template: built_in + custom }, status: :ok)
  end

  # POST /api/me/page_templates  { name, page_id }
  # Saves one of the user's pages as a private template.
  def create
    validate_contract(PageTemplateContract) do |validated_params|
      page = policy_scope(Page).find(validated_params[:page_id])
      template = PageTemplate.from_page(page, name: validated_params[:name])

      if template.save
        render(json: { page_template: serialize_custom(template) }, status: :created)
      else
        render(json: { errors: template.errors.full_messages }, status: :unprocessable_entity)
      end
    end
  end

  # PATCH /api/me/page_templates/:id  { visibility, description, author_page_id }
  # Publishes to (or removes from) the Community gallery. Removing takes it
  # out immediately; pages already created from it keep their copies.
  def update
    template = @current_user.page_templates.find(params[:id].to_s.delete_prefix(CUSTOM_PREFIX))

    validate_contract(PageTemplatePublishContract) do |validated_params|
      if validated_params[:visibility] == "public"
        # The author is shown through one of the user's own public pages.
        author_page = policy_scope(Page).visible.find(validated_params[:author_page_id])
        template.publish!(author_page: author_page, description: validated_params[:description])
      else
        template.unpublish!
      end
      render(json: { page_template: serialize_custom(template) }, status: :ok)
    end
  rescue ActiveRecord::RecordInvalid => e
    render(json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity)
  end

  # DELETE /api/me/page_templates/:id  (only the user's own)
  def destroy
    @current_user.page_templates.find(params[:id].to_s.delete_prefix(CUSTOM_PREFIX)).destroy!
    head(:no_content)
  end
end
