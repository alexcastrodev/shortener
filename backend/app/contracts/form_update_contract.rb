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
    optional(:cover_position).filled(:integer)
    optional(:intro_enabled).filled(:bool)
    optional(:start_label).maybe(:string)
  end
end
