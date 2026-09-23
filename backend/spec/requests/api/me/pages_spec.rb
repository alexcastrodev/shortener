require "rails_helper"

RSpec.describe("/api/me/pages", type: :request) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  describe "GET /api/me/pages" do
    it "lists only the current user's pages" do
      mine = FactoryBot.create(:page, user: current_user)
      FactoryBot.create(:page)

      get "/api/me/pages", headers: auth_headers

      expect(response).to(have_http_status(:ok))
      slugs = JSON.parse(response.body)["page"].map { |p| p["slug"] }
      expect(slugs).to(eq([mine.slug]))
    end

    it "requires authentication" do
      get "/api/me/pages"

      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "GET /api/me/pages/:id" do
    it "returns the page with its links in order" do
      page = FactoryBot.create(:page, user: current_user)
      second = FactoryBot.create(:page_link, page: page, label: "Second", position: 2)
      first = FactoryBot.create(:page_link, page: page, label: "First", position: 1)

      get "/api/me/pages/#{page.id}", headers: auth_headers

      expect(response).to(have_http_status(:ok))
      body = JSON.parse(response.body)["page"]
      expect(body["links"].map { |l| l["id"] }).to(eq([first.id, second.id]))
      expect(body["public_url"]).to(end_with("/u/#{page.slug}"))
    end

    it "does not expose another user's page" do
      other = FactoryBot.create(:page)

      get "/api/me/pages/#{other.id}", headers: auth_headers

      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "POST /api/me/pages" do
    it "creates a page with a normalized slug" do
      post "/api/me/pages", params: { slug: "  Alex.Castro ", display_title: "Alex" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:created))
      expect(current_user.pages.last.slug).to(eq("alex.castro"))
    end

    it "rejects a slug that is already taken, even by a deleted page" do
      FactoryBot.create(:page, slug: "taken").soft_delete!

      post "/api/me/pages", params: { slug: "taken" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:unprocessable_entity))
    end

    ["admin", "a", "has space", "-dash", "Ünïcode", "x" * 31].each do |slug|
      it "rejects the slug #{slug.inspect}" do
        expect do
          post("/api/me/pages", params: { slug: slug }, headers: auth_headers, as: :json)
        end.not_to(change(Page, :count))

        expect(response).to(have_http_status(:unprocessable_entity))
      end
    end

    it "accepts one of the preset themes" do
      post "/api/me/pages", params: { slug: "themed", theme: "midnight" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:created))
      expect(current_user.pages.last.theme).to(eq("midnight"))
    end

    it "rejects an unknown theme" do
      post "/api/me/pages", params: { slug: "themed", theme: "neon" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:unprocessable_entity))
    end
  end

  describe "PATCH /api/me/pages/:id" do
    it "updates the page" do
      page = FactoryBot.create(:page, user: current_user)

      patch "/api/me/pages/#{page.id}", params: { bio: "New bio", published: false }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:ok))
      expect(page.reload).to(have_attributes(bio: "New bio", published: false))
    end

    it "cannot update another user's page" do
      other = FactoryBot.create(:page, bio: "Original")

      patch "/api/me/pages/#{other.id}", params: { bio: "Hacked" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:not_found))
      expect(other.reload.bio).to(eq("Original"))
    end
  end

  describe "DELETE /api/me/pages/:id" do
    it "soft deletes the page" do
      page = FactoryBot.create(:page, user: current_user)

      delete "/api/me/pages/#{page.id}", headers: auth_headers

      expect(response).to(have_http_status(:no_content))
      expect(Page.find_by(id: page.id)).to(be_nil)
      expect(Page.with_deleted.find(page.id).deleted_at).to(be_present)
    end
  end
end
