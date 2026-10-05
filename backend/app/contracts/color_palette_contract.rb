class ColorPaletteContract < ApplicationContract
  params do
    required(:name).filled(:string, max_size?: 40)
    required(:custom_colors).hash do
      required(:background).filled(:string)
      required(:text).filled(:string)
      required(:accent).filled(:string)
    end
  end
end
