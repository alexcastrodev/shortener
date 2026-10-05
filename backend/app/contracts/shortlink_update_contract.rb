class ShortlinkUpdateContract < ApplicationContract
  params do
    optional(:original_url).filled(:string, max_size?: 2048)
    optional(:title).maybe(:string, max_size?: 255)
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
