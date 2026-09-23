class PageContract < ApplicationContract
  params do
    required(:slug).filled(:string)
    optional(:display_title).maybe(:string)
    optional(:bio).maybe(:string)
    optional(:theme).filled(:string)
    optional(:published).filled(:bool)
    optional(:expires_at).maybe(:time)
    # Built-in template key or "custom-<id>" (see PageTemplateLookup).
    optional(:template).maybe(:string)
  end

  rule(:expires_at) do
    key.failure("must be in the future") if value && value <= Time.current
  end
end
