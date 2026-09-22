class ShortlinkContract < ApplicationContract
  params do
    required(:original_url).filled(:string)
    optional(:title).maybe(:string)
  end

  rule(:original_url).validate(:http_url)
end
