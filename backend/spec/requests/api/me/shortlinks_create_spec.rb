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

      expect(response).to(have_http_status(:unprocessable_entity))
    end
  end
end
