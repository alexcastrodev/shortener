require "rails_helper"

RSpec.describe("POST /api/shortlinks", type: :request) do
  before do
    host! "localhost"
  end

  it "route does not exist (unauthenticated shortlink creation removed)" do
    post "/api/shortlinks",
      params: { original_url: "https://example.com", title: "Example" },
      as: :json

    expect(response).to(have_http_status(:not_found))
  end
end
