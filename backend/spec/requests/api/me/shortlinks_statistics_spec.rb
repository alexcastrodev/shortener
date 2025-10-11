require "rails_helper"

RSpec.describe("GET /api/me/shortlinks/:id/statistics", type: :request) do
  include_context "authenticated user"

  let(:shortlink) { current_user.shortlinks.create!(original_url: "https://example.com") }

  before do
    host! "localhost"
  end

  describe "authorization" do
    it "returns unauthorized when the token is missing" do
      get "/api/me/shortlinks/#{shortlink.id}/statistics"

      expect(response).to(have_http_status(:unauthorized))
      body = JSON.parse(response.body)
      expect(body["message"]).to(eq("Missing token"))
    end

    it "returns not found when the shortlink does not belong to the user" do
      other_user = User.create!(email: "other@example.com")
      other_link = other_user.shortlinks.create!(original_url: "https://another.example.com")

      get "/api/me/shortlinks/#{other_link.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:not_found))
      body = JSON.parse(response.body)
      expect(body["message"]).to(eq("Resource not found"))
    end
  end

  describe "browser statistics" do
    before do
      2.times do
        shortlink.events.create!(
          country_code: "BR",
          region: "SP",
          platform: "web",
          browser: "Chrome",
        )
      end

      shortlink.events.create!(
        country_code: "US",
        region: "CA",
        platform: "mobile",
        browser: "Safari",
      )
    end

    it "returns browser statistics grouped by browser" do
      get "/api/me/shortlinks/#{shortlink.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:ok))

      body = JSON.parse(response.body)
      browser_stats = body.fetch("browser_statistics")

      expect(browser_stats).to(be_an(Array))
      expect(browser_stats.size).to(eq(2))

      chrome_stats = browser_stats.find { |entry| entry["name"] == "Chrome" }
      expect(chrome_stats).to(be_present)
      expect(chrome_stats["value"].to_i).to(eq(2))

      safari_stats = browser_stats.find { |entry| entry["name"] == "Safari" }
      expect(safari_stats).to(be_present)
      expect(safari_stats["value"].to_i).to(eq(1))
    end
  end

  describe "country statistics" do
    before do
      2.times do
        shortlink.events.create!(
          country_code: "BR",
          region: "SP",
          platform: "web",
          browser: "Chrome",
        )
      end

      shortlink.events.create!(
        country_code: "US",
        region: "CA",
        platform: "mobile",
        browser: "Safari",
      )
    end

    it "returns country statistics grouped by country" do
      get "/api/me/shortlinks/#{shortlink.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:ok))

      body = JSON.parse(response.body)
      country_stats = body.fetch("country_statistics")

      expect(country_stats).to(be_an(Array))
      expect(country_stats.size).to(eq(2))

      brazil_stats = country_stats.find { |entry| entry["country"] == "BR" }
      expect(brazil_stats).to(be_present)
      expect(brazil_stats["count"].to_i).to(eq(2))

      us_stats = country_stats.find { |entry| entry["country"] == "US" }
      expect(us_stats).to(be_present)
      expect(us_stats["count"].to_i).to(eq(1))
    end
  end

  describe "empty statistics" do
    it "returns empty statistics when shortlink has no events" do
      get "/api/me/shortlinks/#{shortlink.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:ok))

      body = JSON.parse(response.body)
      expect(body["browser_statistics"]).to(eq([]))
      expect(body["country_statistics"]).to(eq([]))
      expect(body["device_statistics"]).to(eq([]))
      expect(body["region_statistics"]).to(eq([]))
    end
  end

  describe "device statistics" do
    it "returns device statistics grouped by platform" do
      2.times do
        shortlink.events.create!(
          country_code: "BR",
          region: "SP",
          platform: "web",
          browser: "Chrome",
        )
      end

      shortlink.events.create!(
        country_code: "US",
        region: "CA",
        platform: "mobile",
        browser: "Safari",
      )

      get "/api/me/shortlinks/#{shortlink.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:ok))

      body = JSON.parse(response.body)
      device_stats = body.fetch("device_statistics")

      expect(device_stats).to(be_an(Array))
      expect(device_stats.size).to(eq(2))

      web_stats = device_stats.find { |entry| entry["name"] == "web" }
      expect(web_stats).to(be_present)
      expect(web_stats["value"].to_i).to(eq(2))

      mobile_stats = device_stats.find { |entry| entry["name"] == "mobile" }
      expect(mobile_stats).to(be_present)
      expect(mobile_stats["value"].to_i).to(eq(1))
    end

    it "returns device statistics sorted by count in descending order" do
      3.times do
        shortlink.events.create!(
          country_code: "US",
          region: "CA",
          platform: "mobile",
          browser: "Safari",
        )
      end

      shortlink.events.create!(
        country_code: "BR",
        region: "SP",
        platform: "web",
        browser: "Chrome",
      )

      get "/api/me/shortlinks/#{shortlink.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:ok))

      body = JSON.parse(response.body)
      device_stats = body["device_statistics"]

      expect(device_stats.first["name"]).to(eq("mobile"))
      expect(device_stats.first["value"].to_i).to(eq(3))
      expect(device_stats.last["name"]).to(eq("web"))
      expect(device_stats.last["value"].to_i).to(eq(1))
    end

    it "aggregates device statistics across multiple platforms" do
      shortlink.events.create!(platform: "web", country_code: "US", region: "CA", browser: "Chrome")
      shortlink.events.create!(platform: "mobile", country_code: "US", region: "CA", browser: "Safari")
      shortlink.events.create!(platform: "tablet", country_code: "US", region: "CA", browser: "Safari")
      shortlink.events.create!(platform: "web", country_code: "BR", region: "SP", browser: "Firefox")

      get "/api/me/shortlinks/#{shortlink.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:ok))

      body = JSON.parse(response.body)
      device_stats = body["device_statistics"]

      expect(device_stats.size).to(eq(3))
      platforms = device_stats.map { |stat| stat["name"] }
      expect(platforms).to(contain_exactly("web", "mobile", "tablet"))

      web_count = device_stats.find { |s| s["name"] == "web" }["value"].to_i
      expect(web_count).to(eq(2))
    end
  end

  describe "user scope" do
    it "aggregates statistics across all user's shortlinks" do
      link1 = current_user.shortlinks.create!(original_url: "https://example1.com")
      2.times do
        link1.events.create!(
          country_code: "BR",
          region: "SP",
          platform: "web",
          browser: "Chrome",
        )
      end

      link2 = current_user.shortlinks.create!(original_url: "https://example2.com")
      link2.events.create!(
        country_code: "BR",
        region: "RJ",
        platform: "web",
        browser: "Edge",
      )

      get "/api/me/shortlinks/#{link1.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:ok))

      body = JSON.parse(response.body)

      browser_stats = body["browser_statistics"]
      expect(browser_stats.size).to(be >= 2)

      device_stats = body["device_statistics"]
      web_count = device_stats.find { |s| s["name"] == "web" }&.dig("value").to_i
      expect(web_count).to(eq(3))
    end

    it "does not include events from other users' shortlinks" do
      current_user_link = current_user.shortlinks.create!(original_url: "https://my-link.com")
      current_user_link.events.create!(
        country_code: "BR",
        region: "SP",
        platform: "web",
        browser: "Chrome",
      )

      other_user = User.create!(email: "other@example.com")
      other_link = other_user.shortlinks.create!(original_url: "https://other-link.com")
      other_link.events.create!(
        country_code: "US",
        region: "CA",
        platform: "mobile",
        browser: "Safari",
      )

      get "/api/me/shortlinks/#{current_user_link.id}/statistics", headers: auth_headers

      expect(response).to(have_http_status(:ok))

      body = JSON.parse(response.body)

      browser_stats = body["browser_statistics"]
      expect(browser_stats.size).to(eq(1))
      expect(browser_stats.first["name"]).to(eq("Chrome"))

      country_stats = body["country_statistics"]
      expect(country_stats.size).to(eq(1))
      expect(country_stats.first["country"]).to(eq("BR"))

      device_stats = body["device_statistics"]
      expect(device_stats.size).to(eq(1))
      expect(device_stats.first["name"]).to(eq("web"))
      expect(device_stats.first["value"].to_i).to(eq(1))
    end
  end
end
