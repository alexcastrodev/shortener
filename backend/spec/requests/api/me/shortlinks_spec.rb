require "rails_helper"

RSpec.describe("POST /api/shortlinks", type: :request, vcr: true) do
  before do
    host! "localhost"
  end

  it "creates a new public shortlink" do
    post "/api/shortlinks",
      params: { original_url: "https://example.com", title: "Example" },
      as: :json

    expect(response).to(have_http_status(:created))
    json_response = JSON.parse(response.body)
    expect(json_response["public_shortlink"]).to(include("original_url", "short_url"))
  end

  context "when the original URL is unsafe" do
    include_context "authenticated user"

    it "Validate URL safety" do
      post "/api/shortlinks",
        params: { original_url: UNSAFE_URL, title: "Malicious" },
        as: :json

      expect(response).to(have_http_status(:created))
      expect(enqueued_jobs.size).to(eq(1))

      # Run job
      perform_enqueued_jobs

      shortlink = Shortlink.last
      expect(enqueued_jobs.size).to(eq(0))
      expect(shortlink.safe).to(be_falsey)
      expect(shortlink.safe_checked_at).to(be_present)
    end

    it "Validate URL safety should not keep cache" do
      post "/api/shortlinks",
        params: { original_url: UNSAFE_URL, title: "Malicious" },
        as: :json

      expect(enqueued_jobs.size).to(eq(1))
      shortlink = Shortlink.last

      Rails.cache.redis.with do |conn|
        cached_url = conn.get(shortlink.cache_key)
        expect(cached_url).not_to(be_nil)
      end

      # Run job
      perform_enqueued_jobs

      expect(enqueued_jobs.size).to(eq(0))

      # Should NOT keep in cache
      Rails.cache.redis.with do |conn|
        cached_url = conn.get(shortlink.cache_key)
        expect(cached_url).to(be_nil)
      end
    end
  end
end
