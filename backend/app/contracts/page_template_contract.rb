class PageTemplateContract < ApplicationContract
  params do
    required(:name).filled(:string, max_size?: 60)
    required(:page_id).filled(:integer)
  end
end
