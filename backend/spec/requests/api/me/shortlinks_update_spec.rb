require "rails_helper"

RSpec.describe("PATCH /api/me/shortlinks/:id", type: :request, vcr: true) do
  include_context "authenticated user"

  let(:shortlink) { current_user.shortlinks.create!(original_url: "https://google.com", title: "Search") }

  before do
    host! "localhost"
  end

  describe "authorization" do
    it "returns unauthorized when the token is missing" do
      patch "/api/me/shortlinks/#{shortlink.id}", params: { original_url: "https://microsoft.com" }, as: :json

      expect(response).to(have_http_status(:unauthorized))
      body = JSON.parse(response.body)
      expect(body["message"]).to(eq("Missing token"))
    end

    it "returns not found when the shortlink belongs to another user" do
      other_user = User.create!(email: "other@example.com")
      other_link = other_user.shortlinks.create!(original_url: "https://another.example.com")

      patch "/api/me/shortlinks/#{other_link.id}",
        params: { original_url: "https://microsoft.com" },
        headers: auth_headers,
        as: :json

      expect(response).to(have_http_status(:not_found))
      body = JSON.parse(response.body)
      expect(body["message"]).to(eq("Resource not found"))
    end
  end

  describe "changing the destination URL" do
    it "updates original_url while keeping the same short_code" do
      original_code = shortlink.short_code

      patch "/api/me/shortlinks/#{shortlink.id}",
        params: { original_url: "https://microsoft.com" },
        headers: auth_headers,
        as: :json

      expect(response).to(have_http_status(:ok))
      body = JSON.parse(response.body)["shortlink"]
      expect(body["original_url"]).to(eq("https://microsoft.com"))
      expect(body["short_code"]).to(eq(original_code))

      shortlink.reload
      expect(shortlink.original_url).to(eq("https://microsoft.com"))
      expect(shortlink.short_code).to(eq(original_code))
    end

    it "keeps analytics tracking against the same record" do
      shortlink.events.create!(country_code: "BR", region: "SP", platform: "web", browser: "Chrome")
      shortlink.events.create!(country_code: "US", region: "CA", platform: "web", browser: "Firefox")
      shortlink.reload
      expect(shortlink.events_count).to(eq(2))

      patch "/api/me/shortlinks/#{shortlink.id}",
        params: { original_url: "https://microsoft.com" },
        headers: auth_headers,
        as: :json

      expect(response).to(have_http_status(:ok))

      shortlink.reload
      expect(shortlink.events.count).to(eq(2))
      expect(shortlink.events_count).to(eq(2))
    end

    it "refreshes the redirect cache" do
      link_id = shortlink.id # create the record before stubbing
      expect_any_instance_of(Shortlink).to(receive(:save_cache))

      patch "/api/me/shortlinks/#{link_id}",
        params: { original_url: "https://microsoft.com" },
        headers: auth_headers,
        as: :json

      expect(response).to(have_http_status(:ok))
    end

    it "re-runs the safety check when the URL changes" do
      link_id = shortlink.id # create the record (enqueues a create-time safety check)
      clear_enqueued_jobs

      patch "/api/me/shortlinks/#{link_id}",
        params: { original_url: "https://microsoft.com" },
        headers: auth_headers,
        as: :json

      expect(response).to(have_http_status(:ok))
      expect(enqueued_jobs.size).to(eq(1))
      expect(enqueued_jobs.first[:job]).to(eq(SafetyUrlJob))
    end
  end

  describe "updating only the title" do
    it "does not refresh the cache when original_url is unchanged" do
      link_id = shortlink.id # create the record before stubbing
      expect_any_instance_of(Shortlink).not_to(receive(:save_cache))

      patch "/api/me/shortlinks/#{link_id}",
        params: { title: "New title" },
        headers: auth_headers,
        as: :json

      expect(response).to(have_http_status(:ok))
      expect(shortlink.reload.title).to(eq("New title"))
    end

    it "does not enqueue a safety check when original_url is unchanged" do
      link_id = shortlink.id # create the record (enqueues a create-time safety check)
      clear_enqueued_jobs

      patch "/api/me/shortlinks/#{link_id}",
        params: { title: "New title" },
        headers: auth_headers,
        as: :json

      expect(response).to(have_http_status(:ok))
      expect(enqueued_jobs.size).to(eq(0))
    end
  end
end
