class FormTemplateApplicationContract < ApplicationContract
  params do
    required(:template).filled(:string)
    optional(:locale).maybe(:string)
  end
end
