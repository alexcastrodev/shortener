require "rails_helper"

RSpec.describe("Admin Users", type: :request, vcr: true) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  it "List all users" do
    get "/api/admin/users", headers: auth_headers

    expect(response).to(have_http_status(:forbidden))
  end

  it "List all users" do
    get "/api/admin/users", headers: admin_auth_headers

    expect(response).to(have_http_status(:ok))
    json_response = JSON.parse(response.body)
    expect(json_response["user"]).to(be_an(Array))
  end
end
