require "rails_helper"

RSpec.describe("Community templates", type: :request) do
  include_context "authenticated user"

  let(:author) { FactoryBot.create(:user) }
  let(:author_page) { FactoryBot.create(:page, user: author, slug: "author-page", display_title: "Author") }

  before do
    host! "localhost"
  end

  def json
    JSON.parse(response.body)
  end

  def headers_for(user)
    { "Authorization" => "Bearer #{SessionToken.issue(user)}" }
  end

  def published_template(name: "Shared", uses: 0, published_at: Time.current)
    template = PageTemplate.create!(
      user: author,
      name: name,
      theme: "sunset",
      items: [
        { "kind" => "header", "label" => "Real header", "url" => nil, "icon" => nil, "active" => true },
        { "kind" => "link", "label" => "Real link", "url" => "https://real.example.org", "icon" => nil, "active" => true },
      ],
    )
    template.publish!(author_page: author_page, description: "Nice")
    template.update!(uses_count: uses, published_at: published_at)
    template
  end

  describe "GET /api/me/community_templates" do
    it "lists public templates, sorted and paginated, without private or hidden ones" do
      popular = published_template(name: "Popular", uses: 10, published_at: 2.days.ago)
      recent = published_template(name: "Recent", uses: 1, published_at: 1.minute.ago)
      published_template(name: "Hidden").update!(hidden_at: Time.current)
      PageTemplate.create!(user: author, name: "Private", theme: "default", items: [])

      get "/api/me/community_templates", headers: auth_headers
      expect(json["page_template"].map { |template| template["name"] }).to(eq(["Popular", "Recent"]))
      expect(json["page_template"].first).to(include("id" => "community-#{popular.id}", "uses_count" => 10, "community" => true))
      expect(json["meta"]).to(include("total" => 2))

      get "/api/me/community_templates", params: { sort: "new", per_page: 1, page: 1 }, headers: auth_headers
      expect(json["page_template"].map { |template| template["id"] }).to(eq(["community-#{recent.id}"]))

      get "/api/me/community_templates", params: { sort: "new", per_page: 1, page: 2 }, headers: auth_headers
      expect(json["page_template"].map { |template| template["id"] }).to(eq(["community-#{popular.id}"]))
    end

    it "keeps the author label but drops the link when the author page is no longer public" do
      published_template
      author_page.update!(published: false)

      get "/api/me/community_templates", headers: auth_headers

      expect(json["page_template"].first["author"]).to(eq("label" => "Author · @author-page", "slug" => nil))
    end

    it "requires a session" do
      get "/api/me/community_templates"

      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "using a Community template" do
    it "creates a copy with placeholders and counts the use" do
      template = published_template

      post "/api/me/pages", params: { slug: "my-copy", template: "community-#{template.id}" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:created))
      copy = Page.find_by!(slug: "my-copy")
      expect(copy.theme).to(eq("sunset"))
      expect(copy.page_links.map(&:label)).to(eq(["Section 1", "Link 1"]))
      expect(copy.page_links.map(&:url)).not_to(include("https://real.example.org"))
      expect(copy.page_links.find { |link| link.kind == "link" }.active).to(be(false))
      expect(template.reload.uses_count).to(eq(1))
    end

    it "is a copy: later changes to the template do not touch the page" do
      template = published_template
      page = FactoryBot.create(:page, user: current_user, slug: "applied")

      post "/api/me/pages/#{page.id}/apply_template", params: { template: "community-#{template.id}" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:ok))

      template.update!(items: [], theme: "paper")
      template.unpublish!

      expect(page.reload.theme).to(eq("sunset"))
      expect(page.page_links.size).to(eq(2))
    end

    it "does not count the author's own uses" do
      template = published_template
      page = FactoryBot.create(:page, user: author, slug: "authors-other")

      post "/api/me/pages/#{page.id}/apply_template", params: { template: "community-#{template.id}" }, headers: headers_for(author), as: :json

      expect(response).to(have_http_status(:ok))
      expect(template.reload.uses_count).to(eq(0))
    end

    it "cannot use hidden or private templates" do
      template = published_template
      template.update!(hidden_at: Time.current)

      post "/api/me/pages", params: { slug: "nope", template: "community-#{template.id}" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "POST /api/me/community_templates/:id/report" do
    it "accepts one report per user and hides the template after three" do
      template = published_template

      post "/api/me/community_templates/community-#{template.id}/report", params: { reason: "spam" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:no_content))

      post "/api/me/community_templates/community-#{template.id}/report", params: { reason: "spam" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(template.reload.reports_count).to(eq(1))

      2.times do
        post "/api/me/community_templates/#{template.id}/report", params: { reason: "offensive" }, headers: headers_for(FactoryBot.create(:user)), as: :json
      end

      expect(template.reload.hidden_at).to(be_present)
      get "/api/me/community_templates", headers: auth_headers
      expect(json["page_template"]).to(be_empty)
    end

    it "does not let authors report their own template" do
      template = published_template

      post "/api/me/community_templates/#{template.id}/report", params: { reason: "spam" }, headers: headers_for(author), as: :json

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(template.reload.reports_count).to(eq(0))
    end

    it "marks the current user's own templates" do
      published_template

      get "/api/me/community_templates", headers: headers_for(author)
      expect(json["page_template"].first["mine"]).to(be(true))

      get "/api/me/community_templates", headers: auth_headers
      expect(json["page_template"].first["mine"]).to(be(false))
    end

    it "rejects unknown reasons" do
      template = published_template

      post "/api/me/community_templates/#{template.id}/report", params: { reason: "boring" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:unprocessable_entity))
    end
  end

  describe "admin moderation" do
    it "forbids non-admins" do
      template = published_template

      get "/api/admin/page_templates", headers: auth_headers
      expect(response).to(have_http_status(:forbidden))

      post "/api/admin/page_templates/#{template.id}/toggle_hidden", headers: auth_headers
      expect(response).to(have_http_status(:forbidden))
    end

    it "lists reported templates and hides or unhides them" do
      template = published_template
      template.report!(user: current_user, reason: "spam")

      get "/api/admin/page_templates", params: { status: "reported" }, headers: admin_auth_headers
      expect(response).to(have_http_status(:ok))
      expect(json["page_template"].first).to(include("id" => template.id, "reports_count" => 1, "reasons" => { "spam" => 1 }))

      post "/api/admin/page_templates/#{template.id}/toggle_hidden", headers: admin_auth_headers
      expect(json["page_template"]["hidden"]).to(be(true))

      post "/api/admin/page_templates/#{template.id}/toggle_hidden", headers: admin_auth_headers
      expect(json["page_template"]).to(include("hidden" => false, "reports_count" => 0))
      expect(template.reports.count).to(eq(0))
    end
  end
end
