class Api::Me::ColorPalettesController < ApplicationController
  before_action :authenticate_user!

  def index
    palettes = @current_user.color_palettes.order(created_at: :desc)
    render(json: { color_palette: palettes.map { |palette| serialize(palette) } }, status: :ok)
  end

  def create
    validate_contract(ColorPaletteContract) do |validated_params|
      palette = @current_user.color_palettes.new(validated_params)

      if palette.save
        render(json: { color_palette: serialize(palette) }, status: :created)
      else
        render(json: { errors: palette.errors.full_messages }, status: :unprocessable_entity)
      end
    end
  end

  def destroy
    @current_user.color_palettes.find(params[:id]).destroy!
    head(:no_content)
  end

  private

  def serialize(palette)
    { id: palette.id, name: palette.name, custom_colors: palette.custom_colors }
  end
end
