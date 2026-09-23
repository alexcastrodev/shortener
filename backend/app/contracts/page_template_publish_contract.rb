class PageTemplatePublishContract < ApplicationContract
  params do
    required(:visibility).filled(:string, included_in?: PageTemplate::VISIBILITIES)
    optional(:description).maybe(:string, max_size?: 140)
    optional(:author_page_id).maybe(:integer)
  end

  rule(:author_page_id, :visibility) do
    key(:author_page_id).failure("is required to publish") if values[:visibility] == "public" && values[:author_page_id].nil?
  end
end
