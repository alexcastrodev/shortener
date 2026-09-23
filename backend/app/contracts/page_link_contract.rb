class PageLinkContract < ApplicationContract
  params do
    optional(:kind).filled(:string, included_in?: PageLink::KINDS)
    required(:label).filled(:string)
    # Required for links and social icons; section headers have none.
    optional(:url).maybe(:string)
    optional(:icon).maybe(:string, included_in?: PageLink::ICONS)
    optional(:active).filled(:bool)
  end

  rule(:url).validate(:http_url)

  rule(:url, :kind) do
    header = values[:kind] == "header"
    key(:url).failure("must be empty for a header") if header && values[:url].present?
    key(:url).failure("is missing") if !header && values[:url].blank?
  end

  rule(:icon, :kind) do
    key(:icon).failure("is required for a social icon") if values[:kind] == "social" && values[:icon].blank?
  end
end
