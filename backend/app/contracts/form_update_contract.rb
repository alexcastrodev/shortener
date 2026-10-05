class FormUpdateContract < ApplicationContract
  params do
    optional(:title).filled(:string)
    optional(:description).maybe(:string)
    optional(:thank_you_message).maybe(:string)
    optional(:theme).filled(:string)
    optional(:layout).filled(:string)
  end
end
