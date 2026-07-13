require "rails_helper"

RSpec.describe("Admin Users", type: :request, vcr: true) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  describe "GET /api/admin/users" do
    it "forbids non-admin users" do
      get "/api/admin/users", headers: auth_headers

      expect(response).to(have_http_status(:forbidden))
    end

    it "lists all users for admin" do
      get "/api/admin/users", headers: admin_auth_headers

      expect(response).to(have_http_status(:ok))
      json_response = JSON.parse(response.body)
      expect(json_response["user"]).to(be_an(Array))
    end
  end

  describe "POST /api/admin/users/:id/toggle_active" do
    it "forbids non-admin users" do
      target_user = FactoryBot.create(:user)

      post "/api/admin/users/#{target_user.id}/toggle_active", headers: auth_headers

      expect(response).to(have_http_status(:forbidden))
    end

    it "deactivates an active user" do
      target_user = FactoryBot.create(:user)

      post "/api/admin/users/#{target_user.id}/toggle_active", headers: admin_auth_headers

      expect(response).to(have_http_status(:ok))
      target_user.reload
      expect(target_user.deactivated_at).to(be_present)
    end

    it "reactivates a deactivated user" do
      target_user = FactoryBot.create(:user)
      target_user.update!(deactivated_at: Time.current)

      post "/api/admin/users/#{target_user.id}/toggle_active", headers: admin_auth_headers

      expect(response).to(have_http_status(:ok))
      target_user.reload
      expect(target_user.deactivated_at).to(be_nil)
    end

    it "deactivates user's active shortlinks" do
      target_user = FactoryBot.create(:user)
      shortlink = target_user.shortlinks.create!(original_url: "https://example.com")

      post "/api/admin/users/#{target_user.id}/toggle_active", headers: admin_auth_headers

      expect(response).to(have_http_status(:ok))
      shortlink.reload
      expect(shortlink.inactive_at).to(be_present)
    end

    it "prevents admin from deactivating themselves" do
      post "/api/admin/users/#{current_admin_user.id}/toggle_active", headers: admin_auth_headers

      expect(response).to(have_http_status(:forbidden))
    end
  end
end
