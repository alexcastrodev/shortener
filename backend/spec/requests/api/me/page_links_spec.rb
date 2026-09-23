require "rails_helper"

RSpec.describe("/api/me/pages/:page_id/links", type: :request) do
  include_context "authenticated user"

  let(:page) { FactoryBot.create(:page, user: current_user) }

  before do
    host! "localhost"
  end

  describe "POST" do
    it "appends a link at the end of the page" do
      FactoryBot.create(:page_link, page: page, position: 4)

      post "/api/me/pages/#{page.id}/links", params: { label: "Blog", url: "https://blog.example.com" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:created))
      expect(JSON.parse(response.body)["page_link"]["position"]).to(eq(5))
    end

    ["javascript:alert(1)", "data:text/html,x", "not a url"].each do |url|
      it "rejects #{url.inspect}" do
        post "/api/me/pages/#{page.id}/links", params: { label: "Bad", url: url }, headers: auth_headers, as: :json

        expect(response).to(have_http_status(:unprocessable_entity))
      end
    end

    it "cannot add links to another user's page" do
      other = FactoryBot.create(:page)

      post "/api/me/pages/#{other.id}/links", params: { label: "X", url: "https://x.com" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:not_found))
      expect(other.page_links).to(be_empty)
    end
  end

  describe "PATCH" do
    it "updates a link" do
      link = FactoryBot.create(:page_link, page: page)

      patch "/api/me/pages/#{page.id}/links/#{link.id}", params: { label: "Shop", active: false }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:ok))
      expect(link.reload).to(have_attributes(label: "Shop", active: false))
    end
  end

  describe "DELETE" do
    it "removes a link" do
      link = FactoryBot.create(:page_link, page: page)

      delete "/api/me/pages/#{page.id}/links/#{link.id}", headers: auth_headers

      expect(response).to(have_http_status(:no_content))
      expect(PageLink.exists?(link.id)).to(be(false))
    end
  end

  describe "PATCH reorder" do
    it "reorders every link of the page" do
      a = FactoryBot.create(:page_link, page: page)
      b = FactoryBot.create(:page_link, page: page)
      c = FactoryBot.create(:page_link, page: page)

      patch "/api/me/pages/#{page.id}/links/reorder", params: { ids: [c.id, a.id, b.id] }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:ok))
      expect(page.page_links.reload.map(&:id)).to(eq([c.id, a.id, b.id]))
    end

    it "rejects a list that does not match the page's links" do
      a = FactoryBot.create(:page_link, page: page)
      foreign = FactoryBot.create(:page_link)

      patch "/api/me/pages/#{page.id}/links/reorder", params: { ids: [a.id, foreign.id] }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:unprocessable_entity))
    end
  end
end
