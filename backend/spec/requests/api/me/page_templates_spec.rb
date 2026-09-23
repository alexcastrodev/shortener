require "rails_helper"

RSpec.describe("Page templates", type: :request) do
  include_context "authenticated user"

  let(:page) { FactoryBot.create(:page, user: current_user, slug: "tpl-page") }

  before do
    host! "localhost"
  end

  def json
    JSON.parse(response.body)
  end

  it "lists the built-in templates" do
    get "/api/me/page_templates", headers: auth_headers

    ids = json["page_template"].map { |template| template["id"] }
    expect(ids).to(include("creator", "business", "professional", "musician", "sponsors", "blank"))
    expect(json["page_template"]).to(all(include("built_in" => true)))
  end

  it "creates a page from a template with its layout, theme and hidden placeholders" do
    post "/api/me/pages", params: { slug: "from-tpl", template: "musician" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:created))
    created = Page.find_by!(slug: "from-tpl")
    expect(created.theme).to(eq("ocean"))
    expect(created.page_links.map(&:kind)).to(eq(["social", "social", "social", "header", "link", "link", "header", "link", "link"]))
    expect(created.page_links.reject(&:header?).map(&:active)).to(all(be(false)))
    expect(created.page_links.map(&:position)).to(eq((1..9).to_a))
  end

  it "keeps placeholders off the public page until they are switched on" do
    post "/api/me/pages", params: { slug: "tpl-public", template: "professional" }, headers: auth_headers, as: :json

    get "/api/public/pages/tpl-public"

    expect(JSON.parse(response.body)["page"]["links"]).to(be_empty)
  end

  it "replaces a page's content when a template is applied" do
    FactoryBot.create(:page_link, page: page, label: "Old link")

    post "/api/me/pages/#{page.id}/apply_template", params: { template: "business" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:ok))
    expect(page.reload.theme).to(eq("paper"))
    expect(page.page_links.map(&:label)).not_to(include("Old link"))
    expect(json["page"]["links"].first["label"]).to(eq("Instagram"))
  end

  it "rejects unknown templates without touching the page" do
    link = FactoryBot.create(:page_link, page: page)

    post "/api/me/pages/#{page.id}/apply_template", params: { template: "nope" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:not_found))
    expect(page.page_links.reload).to(eq([link]))
  end

  it "saves a page as a private template and applies it elsewhere" do
    FactoryBot.create(:page_link, page: page, kind: "header", label: "Sponsors", url: nil)
    FactoryBot.create(:page_link, page: page, label: "Real link", url: "https://example.com/real")
    page.update!(theme: "forest")

    post "/api/me/page_templates", params: { name: "My layout", page_id: page.id }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:created))
    template_id = json["page_template"]["id"]
    expect(template_id).to(start_with("custom-"))

    other = FactoryBot.create(:page, user: current_user, slug: "other-page")
    post "/api/me/pages/#{other.id}/apply_template", params: { template: template_id }, headers: auth_headers, as: :json

    expect(other.reload.theme).to(eq("forest"))
    expect(other.page_links.map { |link| [link.kind, link.label, link.url] })
      .to(eq([["header", "Sponsors", nil], ["link", "Real link", "https://example.com/real"]]))
  end

  it "never shows or applies another user's templates" do
    stranger_page = FactoryBot.create(:page)
    stranger_template = PageTemplate.from_page(stranger_page, name: "Theirs").tap(&:save!)

    get "/api/me/page_templates", headers: auth_headers
    expect(json["page_template"].map { |template| template["id"] }).not_to(include("custom-#{stranger_template.id}"))

    post "/api/me/pages/#{page.id}/apply_template", params: { template: "custom-#{stranger_template.id}" }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:not_found))

    delete "/api/me/page_templates/custom-#{stranger_template.id}", headers: auth_headers
    expect(response).to(have_http_status(:not_found))
    expect(PageTemplate.exists?(stranger_template.id)).to(be(true))
  end

  it "cannot save someone else's page as a template" do
    stranger_page = FactoryBot.create(:page)

    post "/api/me/page_templates", params: { name: "Stolen", page_id: stranger_page.id }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:not_found))
  end

  it "deletes the user's own template" do
    template = PageTemplate.from_page(page, name: "Mine").tap(&:save!)

    delete "/api/me/page_templates/custom-#{template.id}", headers: auth_headers

    expect(response).to(have_http_status(:no_content))
    expect(PageTemplate.exists?(template.id)).to(be(false))
  end
end
