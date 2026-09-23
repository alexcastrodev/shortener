require "rails_helper"

RSpec.describe("Page link kinds (link, social icon, section header)", type: :request) do
  include_context "authenticated user"

  let(:page) { FactoryBot.create(:page, user: current_user, slug: "kinds") }

  before do
    host! "localhost"
  end

  def create_link(params)
    post "/api/me/pages/#{page.id}/links", params: params, headers: auth_headers, as: :json
    response
  end

  it "creates a section header without a URL" do
    expect(create_link(kind: "header", label: "Sponsors")).to(have_http_status(:created))
    expect(page.page_links.last).to(have_attributes(kind: "header", url: nil))
  end

  it "rejects a header with a URL" do
    expect(create_link(kind: "header", label: "Sponsors", url: "https://example.com")).to(have_http_status(:unprocessable_entity))
  end

  it "still requires a URL for regular links" do
    expect(create_link(label: "Site")).to(have_http_status(:unprocessable_entity))
  end

  it "creates a social icon for a known network" do
    expect(create_link(kind: "social", label: "Instagram", url: "https://www.instagram.com/marina", icon: "instagram"))
      .to(have_http_status(:created))
  end

  it "accepts OnlyFans as a social icon" do
    expect(create_link(kind: "social", label: "OnlyFans", url: "https://onlyfans.com/marina", icon: "onlyfans"))
      .to(have_http_status(:created))
  end

  it "requires a known icon for social icons" do
    expect(create_link(kind: "social", label: "Instagram", url: "https://www.instagram.com/marina")).to(have_http_status(:unprocessable_entity))
    expect(create_link(kind: "social", label: "Myspace", url: "https://myspace.com/x", icon: "myspace")).to(have_http_status(:unprocessable_entity))
  end

  it "switches a social icon to a button and back" do
    link = FactoryBot.create(:page_link, page: page, kind: "social", icon: "tiktok", url: "https://www.tiktok.com/@marina")

    patch "/api/me/pages/#{page.id}/links/#{link.id}", params: { kind: "link" }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:ok))
    expect(link.reload.kind).to(eq("link"))

    patch "/api/me/pages/#{page.id}/links/#{link.id}", params: { kind: "social" }, headers: auth_headers, as: :json
    expect(link.reload.kind).to(eq("social"))
  end

  it "does not turn a header into a link" do
    header = FactoryBot.create(:page_link, page: page, kind: "header", label: "Sponsors", url: nil)

    patch "/api/me/pages/#{page.id}/links/#{header.id}", params: { kind: "link" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:unprocessable_entity))
    expect(header.reload.kind).to(eq("header"))
  end

  it "exposes kinds on the public page and never tracks clicks on headers" do
    header = FactoryBot.create(:page_link, page: page, kind: "header", label: "Sponsors", url: nil)
    FactoryBot.create(:page_link, page: page, kind: "social", icon: "instagram", url: "https://www.instagram.com/marina")

    get "/api/public/pages/kinds"
    kinds = JSON.parse(response.body)["page"]["links"].map { |l| [l["kind"], l["url"]] }
    expect(kinds).to(eq([["header", nil], ["social", "https://www.instagram.com/marina"]]))

    post "/api/public/pages/kinds/links/#{header.id}/click"
    expect(response).to(have_http_status(:not_found))
  end

  it "skips headers when checking Safe Browsing" do
    header = FactoryBot.create(:page_link, page: page, kind: "header", label: "Sponsors", url: nil)
    expect(GoogleLib::SafeBrowsing::V4::Services).not_to(receive(:unsafe_urls))

    PageLinkSafetyJob.perform_now([header.id])
  end
end
