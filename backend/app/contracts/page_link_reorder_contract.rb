class PageLinkReorderContract < ApplicationContract
  params do
    required(:ids).array(:integer)
  end
end
