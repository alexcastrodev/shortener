require "rails_helper"

RSpec.describe("POST /api/me/shortlinks", type: :request) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  it "creates a shortlink for an http(s) URL" do
    post "/api/me/shortlinks", params: { original_url: "https://example.com/path" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:created))
    created_at = JSON.parse(response.body).dig("shortlink", "created_at")
    expect(Time.iso8601(created_at)).to(be_within(5.seconds).of(Time.current))
  end

  ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "ftp://example.com", "https://", "not a url"].each do |url|
    it "rejects #{url.inspect}" do
      expect do
        post("/api/me/shortlinks", params: { original_url: url }, headers: auth_headers, as: :json)
      end.not_to(change(Shortlink, :count))

      expect(response).to(have_http_status(:unprocessable_content))
    end
  end

  it "rejects a title over 255 characters and a URL over 2048, and accepts the limits" do
    post("/api/me/shortlinks", params: { original_url: "https://example.com", title: "t" * 256 }, headers: auth_headers, as: :json)
    expect(response).to(have_http_status(:unprocessable_content))

    post("/api/me/shortlinks", params: { original_url: "https://example.com/#{"a" * 2040}" }, headers: auth_headers, as: :json)
    expect(response).to(have_http_status(:unprocessable_content))

    post("/api/me/shortlinks", params: { original_url: "https://example.com/#{"a" * 2000}", title: "t" * 255 }, headers: auth_headers, as: :json)
    expect(response).to(have_http_status(:created))
  end

  it "limits creation to 60 links per user every 10 minutes, per user" do
    other_headers = { "Authorization" => "Bearer #{SessionToken.issue(User.create!(email: "other+#{SecureRandom.hex(4)}@example.com"))}" }

    60.times { post("/api/me/shortlinks", params: { original_url: "https://example.com/x" }, headers: auth_headers, as: :json) }
    expect(response).to(have_http_status(:created))

    post("/api/me/shortlinks", params: { original_url: "https://example.com/x" }, headers: auth_headers, as: :json)
    expect(response).to(have_http_status(:too_many_requests))

    post("/api/me/shortlinks", params: { original_url: "https://example.com/x" }, headers: other_headers, as: :json)
    expect(response).to(have_http_status(:created))
  end
end
