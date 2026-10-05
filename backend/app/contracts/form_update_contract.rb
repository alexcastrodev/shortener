class FormUpdateContract < ApplicationContract
  params do
    optional(:title).filled(:string)
    optional(:description).maybe(:string)
    optional(:thank_you_message).maybe(:string)
    optional(:theme).filled(:string)
    optional(:custom_colors).maybe(:hash) do
      required(:background).filled(:string)
      required(:text).filled(:string)
      required(:accent).filled(:string)
    end
    optional(:layout).filled(:string)
  end
end
