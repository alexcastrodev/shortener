require "rails_helper"

RSpec.describe("POST /api/public/pages/:slug/links/:page_link_id/click", type: :request) do
  let(:page) { FactoryBot.create(:page, slug: "clicky") }
  let(:link) { FactoryBot.create(:page_link, page: page) }
  let(:headers) do
    {
      "CF-Connecting-IP" => "203.0.113.#{rand(1..254)}",
      "CF-IPCountry" => "br",
      "User-Agent" => "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    }
  end

  before do
    host! "localhost"
  end

  it "records the click and bumps the counter" do
    post "/api/public/pages/clicky/links/#{link.id}/click", params: { referer: "https://instagram.com" }, headers: headers, as: :json

    expect(response).to(have_http_status(:no_content))
    click = link.page_link_clicks.last
    expect(click).to(have_attributes(
      ip_address: headers["CF-Connecting-IP"],
      country_code: "BR",
      platform: "iOS",
      browser: "Safari",
      referer: "https://instagram.com",
    ))
    expect(link.reload.clicks_count).to(eq(1))
  end

  it "tracks clicks on pages whose slug contains dots" do
    dotted = FactoryBot.create(:page, slug: "jane.doe")
    dotted_link = FactoryBot.create(:page_link, page: dotted)

    post "/api/public/pages/jane.doe/links/#{dotted_link.id}/click", headers: headers

    expect(response).to(have_http_status(:no_content))
    expect(dotted_link.reload.clicks_count).to(eq(1))
  end

  it "ignores clicks on inactive links" do
    link.update!(active: false)

    post "/api/public/pages/clicky/links/#{link.id}/click", headers: headers

    expect(response).to(have_http_status(:not_found))
  end

  it "ignores links that belong to another page" do
    other = FactoryBot.create(:page_link)

    post "/api/public/pages/clicky/links/#{other.id}/click", headers: headers

    expect(response).to(have_http_status(:not_found))
  end

  it "counts a quick repeat from the same visitor once" do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?

    2.times { post("/api/public/pages/clicky/links/#{link.id}/click", headers: headers) }

    expect(link.reload.clicks_count).to(eq(1))
  end
end
