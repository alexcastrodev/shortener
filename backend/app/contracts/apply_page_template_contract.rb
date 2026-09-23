class ApplyPageTemplateContract < ApplicationContract
  params do
    required(:template).filled(:string)
  end
end
