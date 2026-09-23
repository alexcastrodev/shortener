require "rails_helper"

RSpec.describe("Bio page statistics", type: :request) do
  include_context "authenticated user"

  let(:page) { FactoryBot.create(:page, user: current_user, slug: "stats-page") }
  let!(:button) { page.page_links.create!(kind: "link", label: "Portfolio", url: "https://example.com/p", position: 1) }
  let!(:instagram) { page.page_links.create!(kind: "social", label: "Instagram", icon: "instagram", url: "https://instagram.com/me", position: 2) }
  let!(:header) { page.page_links.create!(kind: "header", label: "Shop", position: 3) }

  before do
    host! "localhost"
  end

  def json
    JSON.parse(response.body)
  end

  def click(link, at: Time.current, user_agent: "Mozilla/5.0 (iPhone) Safari/604.1", referer: nil, country: "PT")
    link.page_link_clicks.create!(
      clicked_at: at,
      user_agent: user_agent,
      referer: referer,
      country_code: country,
      region: "Lisbon",
      platform: UserAgentParser.platform(user_agent),
      browser: UserAgentParser.browser(user_agent),
      ip_address: "1.1.1.1",
    )
  end

  it "counts buttons and social icons, and who clicked" do
    click(button, user_agent: "Mozilla/5.0 (iPhone) Instagram 312.0")
    click(button, referer: "https://t.co/x", country: "BR")
    click(instagram)

    get "/api/me/pages/#{page.id}/statistics", headers: auth_headers

    expect(response).to(have_http_status(:ok))
    expect(json).to(include("period_days" => 30, "total_clicks" => 3, "period_clicks" => 3))
    expect(json["links"].map { |link| [link["label"], link["clicks"]] }).to(eq([["Portfolio", 2], ["Instagram", 1]]))
    expect(json["links"].map { |link| link["kind"] }).not_to(include("header"))
    expect(json["sources"]).to(match_array([{ "name" => "Instagram", "clicks" => 1 }, { "name" => "X", "clicks" => 1 }, { "name" => "Direct", "clicks" => 1 }]))
    expect(json["devices"]).to(eq([{ "name" => "iOS", "clicks" => 3 }]))
    expect(json["browsers"]).to(match_array([{ "name" => "Safari", "clicks" => 2 }, { "name" => "Instagram app", "clicks" => 1 }]))
    expect(json["countries"]).to(eq([{ "name" => "PT", "clicks" => 2 }, { "name" => "BR", "clicks" => 1 }]))
  end

  it "limits the period and fills every day of it" do
    click(button, at: 2.days.ago)
    click(button, at: 20.days.ago)

    get "/api/me/pages/#{page.id}/statistics", params: { days: 7 }, headers: auth_headers

    expect(json).to(include("period_days" => 7, "period_clicks" => 1, "total_clicks" => 2))
    expect(json["timeline"].size).to(eq(7))
    expect(json["timeline"].sum { |day| day["clicks"] }).to(eq(1))
    expect(json["timeline"].last["date"]).to(eq(Time.current.utc.to_date.iso8601))
  end

  it "falls back to 30 days for an unknown period" do
    get "/api/me/pages/#{page.id}/statistics", params: { days: 365 }, headers: auth_headers

    expect(json["period_days"]).to(eq(30))
    expect(json["period_clicks"]).to(eq(0))
  end

  it "is private to the page owner" do
    other = FactoryBot.create(:page, slug: "someone-else")

    get "/api/me/pages/#{other.id}/statistics", headers: auth_headers
    expect(response).to(have_http_status(:not_found))

    get "/api/me/pages/#{page.id}/statistics"
    expect(response).to(have_http_status(:unauthorized))
  end
end
