require "rails_helper"

RSpec.describe("token of a deleted user", type: :request) do
  include_context "authenticated user"

  it "answers 401, not 404" do
    headers = auth_headers
    current_user.destroy!
    get "/api/me/shortlinks", headers: headers
    expect(response).to(have_http_status(:unauthorized))
    expect(response.parsed_body["message"]).to(eq("Invalid or expired token"))
  end
end
