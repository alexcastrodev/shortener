class Api::Me::ShortlinksController < ApplicationController
  before_action :authenticate_user!
  before_action :load_link, only: [:destroy, :show, :statistics, :update]

  # GET /api/me/shortlinks/:id
  def show
    render(json: ShortlinkSerializer.new(@link).serialize, status: :ok)
  end

  # GET /api/me/shortlinks
  def index
    render(
      json: ShortlinkSerializer.new(@current_user.shortlinks.order(created_at: :desc)).serialize(meta: {
        total: @current_user.shortlinks.count,
      }),
      status: :ok,
    )
  end

  # POST /api/me/shortlinks
  def create
    validate_contract(ShortlinkContract) do |validated_params|
      link = @current_user.shortlinks.new(validated_params)
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
      if @link.update(validated_params)
        if @link.saved_change_to_original_url?
          @link.save_cache
          SafetyUrlJob.perform_later(@link.id) if ENV["ENABLE_GOOGLE_SAFE_LINK"].present?
        end
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
      link.destroy
      head(:no_content)
    else
      render(json: { error: "Link not found" }, status: :not_found)
    end
  end

  # GET /api/me/shortlinks/:id/statistics
  def statistics
    render(json: @link.event_statistics, status: :ok)
  end

  private

  def load_link
    link_id = params[:id] || params[:shortlink_id]
    @link = @current_user.shortlinks.find(link_id)
  end
end
