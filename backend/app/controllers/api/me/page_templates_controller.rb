class Api::Me::PageTemplatesController < ApplicationController
  include PageTemplateLookup

  before_action :authenticate_user!

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

  # DELETE /api/me/page_templates/:id  (only the user's own)
  def destroy
    @current_user.page_templates.find(params[:id].to_s.delete_prefix(CUSTOM_PREFIX)).destroy!
    head(:no_content)
  end
end
