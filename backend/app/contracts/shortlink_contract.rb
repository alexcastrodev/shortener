class ShortlinkContract < ApplicationContract
  params do
    required(:original_url).filled(:string)
    optional(:title).maybe(:string)
  end
end
