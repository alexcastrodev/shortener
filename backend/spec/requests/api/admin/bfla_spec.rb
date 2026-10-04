require "rails_helper"

# Non-admins must get the same 403 whether the id exists or not (no existence oracle).
RSpec.describe("Admin member routes authorize before lookup", type: :request, vcr: true) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  [
    "/api/admin/users/%<id>s/toggle_active",
    "/api/admin/shortlinks/%<id>s/toggle_safe",
    "/api/admin/shortlinks/%<id>s/toggle_active",
    "/api/admin/page_templates/%<id>s/toggle_hidden",
    "/api/admin/abuse_signals/%<id>s/dismiss",
  ].each do |template|
    it "answers 403 for a non-admin on #{template}, existing or not" do
      post(format(template, id: 0), headers: auth_headers)
      missing = [response.status, response.body]

      post(format(template, id: FactoryBot.create(:user).id), headers: auth_headers)

      expect(missing.first).to(eq(403))
      expect(response.status).to(eq(403))
    end
  end
end
