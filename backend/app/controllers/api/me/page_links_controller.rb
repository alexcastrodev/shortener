class Api::Me::PageLinksController < ApplicationController
  before_action :authenticate_user!
  before_action :load_page
  before_action :load_link, only: [:update, :destroy]

  # POST /api/me/pages/:page_id/links
  def create
    validate_contract(PageLinkContract) do |validated_params|
      link = @page.page_links.new(validated_params)
      if link.save
        render(json: PageLinkSerializer.new(link).serialize, status: :created)
      else
        render(json: { errors: link.errors.full_messages }, status: :unprocessable_entity)
      end
    end
  end

  # PATCH/PUT /api/me/pages/:page_id/links/:id
  def update
    validate_contract(PageLinkUpdateContract) do |validated_params|
      if @link.update(validated_params)
        render(json: PageLinkSerializer.new(@link).serialize, status: :ok)
      else
        render(json: { errors: @link.errors.full_messages }, status: :unprocessable_entity)
      end
    end
  end

  # DELETE /api/me/pages/:page_id/links/:id
  def destroy
    @link.destroy!
    head(:no_content)
  end

  # PATCH /api/me/pages/:page_id/links/reorder
  # Body: { ids: [3, 1, 2] } — every link of the page, in the new order.
  def reorder
    validate_contract(PageLinkReorderContract) do |validated_params|
      ids = validated_params[:ids]
      if ids.uniq.size != ids.size || ids.sort != @page.page_links.ids.sort
        return render(json: { errors: { ids: ["must list every link of the page exactly once"] } }, status: :unprocessable_entity)
      end

      PageLink.transaction do
        ids.each_with_index do |id, index|
          @page.page_links.where(id: id).update_all(position: index + 1, updated_at: Time.current)
        end
      end

      render(json: PageLinkSerializer.new(@page.page_links.reload).serialize, status: :ok)
    end
  end

  private

  def load_page
    @page = policy_scope(Page).find(params[:page_id])
  end

  def load_link
    @link = @page.page_links.find(params[:id])
  end
end
