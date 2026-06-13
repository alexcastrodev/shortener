class ShortlinkUpdateContract < ApplicationContract
  params do
    optional(:original_url).filled(:string)
    optional(:title).maybe(:string)
  end
end
