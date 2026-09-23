class ShortlinkContract < ApplicationContract
  params do
    required(:original_url).filled(:string)
    optional(:title).maybe(:string)
    # nil or "" removes the password
    optional(:password).maybe(:string)
    optional(:expires_at).maybe(:time)
  end

  rule(:original_url).validate(:http_url)

  rule(:password) do
    key.failure("must be between 4 and 72 characters") if value.present? && !value.length.between?(4, 72)
  end

  rule(:expires_at) do
    key.failure("must be in the future") if value && value <= Time.current
  end
end
