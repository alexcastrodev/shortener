class FormContract < ApplicationContract
  params do
    required(:title).filled(:string)
    optional(:description).maybe(:string)
    optional(:thank_you_message).maybe(:string)
    optional(:theme).filled(:string)
    optional(:layout).filled(:string)
    optional(:template).maybe(:string)
  end
end
