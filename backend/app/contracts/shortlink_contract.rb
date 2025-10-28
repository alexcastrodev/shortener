class ShortlinkContract < ApplicationContract
  params do
    required(:original_url).filled(:string)
    optional(:title).maybe(:string)
    optional(:email).maybe(:string)
  end

  rule(:email).validate(:email_format)
end
