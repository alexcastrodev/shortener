require "rails_helper"

RSpec.describe("DELETE /api/me/shortlinks/:id", type: :request) do
  include_context "authenticated user"

  let(:shortlink) { current_user.shortlinks.create!(original_url: "https://google.com", title: "Search") }

  before do
    host! "localhost"
  end

  it "returns unauthorized when the token is missing" do
    delete "/api/me/shortlinks/#{shortlink.id}", as: :json

    expect(response).to(have_http_status(:unauthorized))
  end

  it "returns not found when the shortlink belongs to another user" do
    other_user = User.create!(email: "other@example.com")
    other_link = other_user.shortlinks.create!(original_url: "https://another.example.com")

    delete "/api/me/shortlinks/#{other_link.id}", headers: auth_headers, as: :json

    expect(response).to(have_http_status(:not_found))
  end

  it "soft deletes immediately and enqueues the purge job" do
    expect {
      delete "/api/me/shortlinks/#{shortlink.id}", headers: auth_headers, as: :json
    }.to(have_enqueued_job(PurgeShortlinkJob).with(shortlink.id))

    expect(response).to(have_http_status(:no_content))
    expect(shortlink.reload.deleted_at).to(be_present)
  end

  it "hides the soft-deleted link from subsequent reads" do
    delete "/api/me/shortlinks/#{shortlink.id}", headers: auth_headers, as: :json

    expect(Shortlink.find_by(id: shortlink.id)).to(be_nil)
    expect(current_user.shortlinks.count).to(eq(0))
  end
end
