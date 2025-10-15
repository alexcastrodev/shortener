require "rails_helper"

RSpec.describe("POST /api/shortlinks", type: :request) do
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
end
