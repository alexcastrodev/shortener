class Api::Me::ShortlinksController < ApplicationController
  before_action :authenticate_user!
  before_action :load_link, only: [:destroy, :show, :statistics, :update, :qr_code]

  # GET /api/me/shortlinks/:id
  def show
    render(json: ShortlinkSerializer.new(@link).serialize, status: :ok)
  end

  # GET /api/me/shortlinks
  def index
    page = [params.fetch(:page, 1).to_i, 1].max
    per_page = params.fetch(:per_page, 20).to_i.clamp(1, 100)

    shortlinks = @current_user.shortlinks.order(created_at: :desc)
    total = shortlinks.count
    shortlinks = shortlinks.offset((page - 1) * per_page).limit(per_page)

    render(
      json: ShortlinkSerializer.new(shortlinks).serialize(meta: {
        total: total,
        page: page,
        per_page: per_page,
      }),
      status: :ok,
    )
  end

  # POST /api/me/shortlinks
  def create
    validate_contract(ShortlinkContract) do |validated_params|
      link = @current_user.shortlinks.new(password_params(validated_params))
      if link.save
        render(json: ShortlinkSerializer.new(link).serialize, status: :created)
      else
        render(json: { errors: link.errors.full_messages }, status: :unprocessable_entity)
      end
    end
  end

  # PATCH/PUT /api/me/shortlinks/:id
  def update
    validate_contract(ShortlinkUpdateContract) do |validated_params|
      if @link.update(password_params(validated_params))
        if @link.saved_change_to_original_url?
          SafetyUrlJob.perform_later(@link.id) if ENV["ENABLE_GOOGLE_SAFE_LINK"].present?
        end
        refresh_cache if cache_affected?
        render(json: ShortlinkSerializer.new(@link).serialize, status: :ok)
      else
        render(json: { errors: @link.errors.full_messages }, status: :unprocessable_entity)
      end
    end
  end

  # DELETE /api/me/shortlinks/:id
  def destroy
    link = @current_user.shortlinks.find_by(id: params[:id])
    if link
      link.soft_delete!
      head(:no_content)
    else
      render(json: { error: "Link not found" }, status: :not_found)
    end
  end

  # GET /api/me/shortlinks/:id/statistics
  def statistics
    render(json: @link.event_statistics, status: :ok)
  end

  # GET /api/me/shortlinks/:id/qr_code
  def qr_code
    svg_response_headers
    send_data(QrCodeService.svg(@link.short_url), type: "image/svg+xml", disposition: "inline", filename: "#{@link.short_code}.svg")
  end

  private

  # A blank password means "remove the password".
  def password_params(validated_params)
    return validated_params unless validated_params.key?(:password)

    validated_params.merge(password: validated_params[:password].presence)
  end

  def cache_affected?
    @link.saved_change_to_original_url? || @link.saved_change_to_password_digest? || @link.saved_change_to_expires_at?
  end

  def refresh_cache
    return if @link.inactive_at.present?

    @link.servable? ? @link.save_cache : @link.remove_cache
  end

  def load_link
    link_id = params[:id] || params[:shortlink_id]
    @link = @current_user.shortlinks.find(link_id)
  end
end
