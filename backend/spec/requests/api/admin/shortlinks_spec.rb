require "rails_helper"

RSpec.describe("Admin Shortlinks", type: :request, vcr: true) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  describe "GET /api/admin/shortlinks" do
    it "forbids non-admin users" do
      get "/api/admin/shortlinks", headers: auth_headers

      expect(response).to(have_http_status(:forbidden))
    end

    it "returns a list for admin users" do
      FactoryBot.create_list(:shortlink, 2)

      get "/api/admin/shortlinks", headers: admin_auth_headers

      expect(response).to(have_http_status(:ok))
      json_response = JSON.parse(response.body)
      expect(json_response["shortlink"]).to(be_an(Array))
      expect(json_response["shortlink"].size).to(eq(2))
      expect(json_response["shortlink"].first).to(include("original_url", "short_code"))
    end

    it "includes associated user when present", dev: true do
      user = FactoryBot.create(:user)
      shortlink = FactoryBot.create(:shortlink, user: user)

      get "/api/admin/shortlinks", headers: admin_auth_headers

      expect(response).to(have_http_status(:ok))
      json_response = JSON.parse(response.body)
      first_shortlink = json_response["shortlink"].find { |s| s["id"] == shortlink.id }
      expect(first_shortlink).to(include("user"))
      expect(first_shortlink["user"]).to(include("id" => user.id, "email" => user.email))
    end
  end

  describe "POST /api/admin/shortlinks/:id/toggle_safe" do
    it "forbids non-admin users" do
      shortlink = FactoryBot.create(:shortlink)

      post "/api/admin/shortlinks/#{shortlink.id}/toggle_safe", headers: auth_headers
      expect(response).to(have_http_status(:forbidden))
    end

    it "toggles safety for admin users" do
      shortlink = FactoryBot.create(:shortlink, safe: true, safe_checked_at: nil)

      post "/api/admin/shortlinks/#{shortlink.id}/toggle_safe", headers: admin_auth_headers

      expect(response).to(have_http_status(:ok))

      json_response = JSON.parse(response.body)

      expect(json_response["shortlink"]).to(include("safe"))
      shortlink.reload
      expect(shortlink.safe).to(be_falsey)
      expect(shortlink.safe_checked_at).to(be_present)
    end
  end
end
