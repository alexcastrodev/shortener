require "rails_helper"

RSpec.describe("Publishing page templates to the Community", type: :request) do
  include_context "authenticated user"

  let(:page) { FactoryBot.create(:page, user: current_user, slug: "marina", display_title: "Marina Costa") }
  let(:template) do
    PageTemplate.create!(
      user: current_user,
      name: "My setup",
      theme: "forest",
      items: [
        { "kind" => "social", "label" => "Insta", "url" => "https://www.instagram.com/marina.secret", "icon" => "instagram", "active" => true },
        { "kind" => "header", "label" => "My shop", "url" => nil, "icon" => nil, "active" => true },
        { "kind" => "link", "label" => "Private booking", "url" => "https://secret.example.org/book", "icon" => nil, "active" => true },
        { "kind" => "link", "label" => "My channel", "url" => "https://youtube.com/@marina", "icon" => "youtube", "active" => true },
      ],
    )
  end

  before do
    host! "localhost"
  end

  def json
    JSON.parse(response.body)
  end

  def publish(params = {})
    patch(
      "/api/me/page_templates/custom-#{template.id}",
      params: { visibility: "public", author_page_id: page.id, description: "Clean layout" }.merge(params),
      headers: auth_headers,
      as: :json,
    )
  end

  it "publishes with the author shown through the page, never the email" do
    publish

    expect(response).to(have_http_status(:ok))
    expect(json["page_template"]).to(include("visibility" => "public", "description" => "Clean layout"))
    expect(json["page_template"]["author"]).to(eq("label" => "Marina Costa · @marina", "slug" => "marina"))
    expect(response.body).not_to(include(current_user.email))
  end

  it "credits a page without a title by its slug alone" do
    page.update!(display_title: nil)

    publish

    expect(json["page_template"]["author"]).to(eq("label" => "@marina", "slug" => "marina"))
  end

  it "keeps the originals for the owner and placeholders in the public version" do
    publish

    expect(json["page_template"]["items"].map { |item| item["label"] }).to(eq(["Insta", "My shop", "Private booking", "My channel"]))
    expect(json["page_template"]["public_items"]).to(eq([
      { "kind" => "social", "label" => "Instagram", "url" => "https://www.instagram.com/your_handle", "icon" => "instagram", "active" => false },
      { "kind" => "header", "label" => "Section 1", "url" => nil, "icon" => nil, "active" => true },
      { "kind" => "link", "label" => "Link 1", "url" => BuiltInPageTemplates::PLACEHOLDER, "icon" => nil, "active" => false },
      { "kind" => "link", "label" => "YouTube link", "url" => BuiltInPageTemplates::PLACEHOLDER, "icon" => "youtube", "active" => false },
    ]))
  end

  it "never shows the originals to other users" do
    publish
    other = User.create!(email: "other@example.com")

    get "/api/me/community_templates", headers: { "Authorization" => "Bearer #{SessionToken.issue(other)}" }

    expect(json["page_template"].size).to(eq(1))
    ["\"Insta\"", "My shop", "Private booking", "marina.secret", "secret.example.org", "youtube.com/@marina", current_user.email].each do |secret|
      expect(response.body).not_to(include(secret))
    end
  end

  it "removes it from the Community immediately when unpublished" do
    publish
    patch "/api/me/page_templates/custom-#{template.id}", params: { visibility: "private" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:ok))
    get "/api/me/community_templates", headers: auth_headers
    expect(json["page_template"]).to(be_empty)
  end

  it "requires one of the user's own visible pages as the author" do
    someone_else = FactoryBot.create(:page, slug: "not-mine")
    publish(author_page_id: someone_else.id)
    expect(response).to(have_http_status(:not_found))

    unpublished = FactoryBot.create(:page, user: current_user, slug: "draft-page", published: false)
    publish(author_page_id: unpublished.id)
    expect(response).to(have_http_status(:not_found))

    publish(author_page_id: nil)
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(template.reload).not_to(be_public)
  end

  it "rejects links in the public description and name" do
    publish(description: "Visit www.spam-site.com now")
    expect(response).to(have_http_status(:unprocessable_entity))

    template.update!(name: "Go to bit.ly/abc")
    publish
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(template.reload).not_to(be_public)
  end

  it "cannot publish someone else's template" do
    other_template = PageTemplate.create!(user: FactoryBot.create(:user), name: "Theirs", theme: "default", items: [])

    patch "/api/me/page_templates/custom-#{other_template.id}", params: { visibility: "public", author_page_id: page.id }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:not_found))
  end

  it "rate limits publishing" do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?

    5.times { publish }
    expect(response).to(have_http_status(:ok))

    publish
    expect(response).to(have_http_status(:too_many_requests))
  end
end
