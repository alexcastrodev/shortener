require "rails_helper"

RSpec.describe("GET /api/public/pages/:slug", type: :request) do
  before do
    host! "localhost"
  end

  it "returns the page with only its active links and no owner data" do
    page = FactoryBot.create(:page, slug: "alex")
    active = FactoryBot.create(:page_link, page: page, label: "Site")
    FactoryBot.create(:page_link, page: page, label: "Hidden", active: false)

    get "/api/public/pages/Alex"

    expect(response).to(have_http_status(:ok))
    body = JSON.parse(response.body)["page"]
    expect(body.keys).to(match_array(["slug", "display_title", "bio", "theme", "avatar_url", "links"]))
    expect(body["links"].map { |l| l["id"] }).to(eq([active.id]))
    expect(body["links"].first.keys).to(match_array(["id", "kind", "label", "url", "icon"]))
  end

  it "finds slugs that contain dots" do
    FactoryBot.create(:page, slug: "jane.doe")

    get "/api/public/pages/jane.doe"

    expect(response).to(have_http_status(:ok))
    expect(JSON.parse(response.body)["page"]["slug"]).to(eq("jane.doe"))
  end

  it "hides links flagged by Safe Browsing" do
    page = FactoryBot.create(:page, slug: "flagged")
    FactoryBot.create(:page_link, page: page, label: "Phish").update_columns(safe: false)

    get "/api/public/pages/flagged"

    expect(JSON.parse(response.body)["page"]["links"]).to(be_empty)
  end

  it "is not found when unpublished" do
    FactoryBot.create(:page, slug: "draft", published: false)

    get "/api/public/pages/draft"

    expect(response).to(have_http_status(:not_found))
  end

  it "is not found when expired" do
    FactoryBot.create(:page, slug: "old", expires_at: 1.minute.ago)

    get "/api/public/pages/old"

    expect(response).to(have_http_status(:not_found))
  end

  it "is not found when deleted" do
    FactoryBot.create(:page, slug: "gone").soft_delete!

    get "/api/public/pages/gone"

    expect(response).to(have_http_status(:not_found))
  end

  it "is not found when the owner is deactivated" do
    page = FactoryBot.create(:page, slug: "banned")
    page.user.update!(deactivated_at: Time.current)

    get "/api/public/pages/banned"

    expect(response).to(have_http_status(:not_found))
  end

  # Rate limiting needs a real cache store; the test env only has one when
  # REDIS_URL is set (as in CI).
  it "rate limits by client IP, ignoring a spoofed X-Forwarded-For" do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?

    FactoryBot.create(:page, slug: "viral")
    headers = { "CF-Connecting-IP" => "203.0.113.#{rand(1..254)}" }

    120.times do |i|
      get "/api/public/pages/viral", headers: headers.merge("X-Forwarded-For" => "198.51.100.#{i % 250}")
    end
    expect(response).to(have_http_status(:ok))

    get "/api/public/pages/viral", headers: headers.merge("X-Forwarded-For" => "198.51.100.251")

    expect(response).to(have_http_status(:too_many_requests))
  end
end
