class Api::Public::PagesController < ApplicationController
  include ClientIp

  # High enough for a page shared virally from one network (CGNAT, offices),
  # low enough to stop scraping every slug.
  rate_limit to: 120,
    within: 1.minute,
    name: "public_pages_show",
    by: -> { client_ip },
    with: -> { render(json: { error: "Too many requests" }, status: :too_many_requests) }

  # GET /api/public/pages/:slug
  def show
    page = Page.visible.includes(:page_links).find_by!(slug: params[:slug].to_s.downcase)
    render(json: PublicPageSerializer.new(page).serialize, status: :ok)
  end
end
