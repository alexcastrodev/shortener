class Api::Me::PagesController < ApplicationController
  include PageTemplateLookup

  before_action :authenticate_user!
  before_action :load_page, only: [:show, :update, :destroy, :upload_avatar, :destroy_avatar, :qr_code, :apply_template]

  # Creating pages is free, but not unbounded: slows down scripted squatting
  # of slugs and bulk phishing pages from fresh accounts.
  rate_limit to: 10,
    within: 1.hour,
    only: :create,
    name: "pages_create",
    by: -> { current_user&.id },
    with: -> { render(json: { error: "Too many pages created, please try again later" }, status: :too_many_requests) }

  # GET /api/me/pages
  def index
    pages = policy_scope(Page).order(created_at: :desc)
    render(json: PageSerializer.new(pages).serialize, status: :ok)
  end

  # GET /api/me/pages/:id
  def show
    render(json: PageSerializer.new(@page, params: { with_links: true }).serialize, status: :ok)
  end

  # POST /api/me/pages
  def create
    validate_contract(PageContract) do |validated_params|
      template_id = validated_params.delete(:template)
      template = find_template(template_id) if template_id.present?
      page = @current_user.pages.new(validated_params)

      Page.transaction do
        page.save!
        ApplyPageTemplate.call(page: page, theme: template["theme"], items: template["items"]) if template
      end
      render(json: PageSerializer.new(page, params: { with_links: true }).serialize, status: :created)
    rescue ActiveRecord::RecordInvalid
      render(json: { errors: page.errors.full_messages }, status: :unprocessable_entity)
    end
  end

  # PATCH/PUT /api/me/pages/:id
  def update
    validate_contract(PageUpdateContract) do |validated_params|
      if @page.update(validated_params)
        render(json: PageSerializer.new(@page, params: { with_links: true }).serialize, status: :ok)
      else
        render(json: { errors: @page.errors.full_messages }, status: :unprocessable_entity)
      end
    end
  end

  # POST /api/me/pages/:page_id/apply_template  { template }
  # Replaces the page's items and theme with the template's.
  def apply_template
    validate_contract(ApplyPageTemplateContract) do |validated_params|
      template = find_template(validated_params[:template])
      ApplyPageTemplate.call(page: @page, theme: template["theme"], items: template["items"])
      render(json: PageSerializer.new(@page.reload, params: { with_links: true }).serialize, status: :ok)
    end
  end

  # DELETE /api/me/pages/:id
  def destroy
    @page.soft_delete!
    head(:no_content)
  end

  # POST /api/me/pages/:page_id/avatar (multipart, field "avatar")
  def upload_avatar
    file = params[:avatar]
    error = AvatarUpload.error_for(file)
    return render(json: { errors: { avatar: [error] } }, status: :unprocessable_entity) if error

    @page.avatar.attach(io: file.tempfile, filename: "avatar", content_type: AvatarUpload.content_type(file))
    render(json: PageSerializer.new(@page.reload, params: { with_links: true }).serialize, status: :ok)
  end

  # DELETE /api/me/pages/:page_id/avatar
  def destroy_avatar
    @page.avatar.purge_later if @page.avatar.attached?
    head(:no_content)
  end

  # GET /api/me/pages/:page_id/qr_code
  def qr_code
    svg_response_headers
    send_data(QrCodeService.svg(@page.public_url), type: "image/svg+xml", disposition: "inline", filename: "#{@page.slug}.svg")
  end

  private

  def load_page
    @page = policy_scope(Page).find(params[:id] || params[:page_id])
  end
end
