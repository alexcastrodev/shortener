class PageUpdateContract < ApplicationContract
  params do
    optional(:slug).filled(:string)
    optional(:display_title).maybe(:string)
    optional(:bio).maybe(:string)
    optional(:theme).filled(:string)
    optional(:custom_colors).maybe(:hash) do
      required(:background).filled(:string)
      required(:text).filled(:string)
      required(:accent).filled(:string)
    end
    optional(:published).filled(:bool)
    optional(:expires_at).maybe(:time)
  end

  rule(:expires_at) do
    key.failure("must be in the future") if value && value <= Time.current
  end
end
