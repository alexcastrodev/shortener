class PageLinkUpdateContract < ApplicationContract
  params do
    # Links and social icons can switch; headers stay headers (see PageLink).
    optional(:kind).filled(:string, included_in?: ["link", "social"])
    optional(:label).filled(:string)
    optional(:url).filled(:string)
    optional(:icon).maybe(:string, included_in?: PageLink::ICONS)
    optional(:active).filled(:bool)
  end

  rule(:url).validate(:http_url)
end
