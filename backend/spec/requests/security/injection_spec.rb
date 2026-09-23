require "rails_helper"

# Attacker-controlled input through every write path added for bio pages
# and shortlinks. React escapes text on render (checked end to end in the
# browser); here the API must refuse executable URLs and treat everything
# else as inert data.
RSpec.describe("Injection hardening", type: :request) do
  include_context "authenticated user"

  let(:page) { FactoryBot.create(:page, user: current_user, slug: "sec-page") }

  before do
    host! "localhost"
  end

  executable_urls = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "javascript://example.com/%0Aalert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "https://example.com\" onmouseover=\"alert(1)",
  ]

  describe "executable URLs" do
    executable_urls.each do |url|
      it "rejects #{url.inspect} for page links" do
        post "/api/me/pages/#{page.id}/links", params: { label: "x", url: url }, headers: auth_headers, as: :json
        expect(response).to(have_http_status(:unprocessable_entity))
      end

      it "rejects #{url.inspect} for shortlinks" do
        post "/api/me/shortlinks", params: { original_url: url }, headers: auth_headers, as: :json
        expect(response).to(have_http_status(:unprocessable_entity))
      end
    end

    it "rejects them when editing an existing link too" do
      link = FactoryBot.create(:page_link, page: page)

      patch "/api/me/pages/#{page.id}/links/#{link.id}", params: { url: "javascript:alert(1)" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(link.reload.url).to(eq("https://example.com"))
    end
  end

  describe "markup in text fields" do
    let(:payload) { %(<img src=x onerror="alert(1)"><script>alert(2)</script>) }

    it "stores and returns it as plain text" do
      patch "/api/me/pages/#{page.id}", params: { display_title: payload.first(80), bio: payload }, headers: auth_headers, as: :json
      post "/api/me/pages/#{page.id}/links", params: { label: payload.first(80), url: "https://example.com" }, headers: auth_headers, as: :json
      post "/api/me/pages/#{page.id}/links", params: { kind: "header", label: payload.first(80) }, headers: auth_headers, as: :json

      get "/api/public/pages/sec-page"

      body = JSON.parse(response.body)["page"]
      expect(body["bio"]).to(eq(payload))
      expect(body["links"].map { |l| l["label"] }).to(all(eq(payload.first(80))))
      expect(response.media_type).to(eq("application/json"))
    end

    it "keeps it inert in Community template names and descriptions" do
      page.update!(display_title: payload.first(80))
      post "/api/me/page_templates", params: { name: payload.first(60), page_id: page.id }, headers: auth_headers, as: :json
      template_id = JSON.parse(response.body)["page_template"]["id"]
      patch "/api/me/page_templates/#{template_id}", params: { visibility: "public", author_page_id: page.id, description: payload.first(140) }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:ok))

      get "/api/me/community_templates", headers: auth_headers

      template = JSON.parse(response.body)["page_template"].first
      expect(template["name"]).to(eq(payload.first(60)))
      expect(template["description"]).to(eq(payload.first(140)))
      expect(template["author"]["label"]).to(start_with(payload.first(80)))
      expect(response.media_type).to(eq("application/json"))
    end
  end

  describe "SQL injection" do
    ["' OR '1'='1", "sec-page' --", "x'; DROP TABLE pages; --", "%"].each do |slug|
      it "treats #{slug.inspect} as a literal slug" do
        page
        get "/api/public/pages/#{ERB::Util.url_encode(slug)}"
        expect(response).to(have_http_status(:not_found))
        expect(Page.count).to(eq(1))
      end
    end

    it "treats a malicious short code as a literal" do
      get "/api/public/shortlinks/#{ERB::Util.url_encode("' OR 1=1 --")}"
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "template ids" do
    ["../../etc/passwd", "custom-0 OR 1=1", "custom-../1", "Kernel", "community-0 OR 1=1", "community-../1"].each do |id|
      it "rejects #{id.inspect}" do
        post "/api/me/pages/#{page.id}/apply_template", params: { template: id }, headers: auth_headers, as: :json
        expect(response).to(have_http_status(:not_found))
      end
    end
  end

  describe "forged client IP headers" do
    let(:link) { FactoryBot.create(:page_link, page: page) }

    it "falls back to the socket address and never stores the forged value" do
      post "/api/public/pages/sec-page/links/#{link.id}/click",
        headers: { "CF-Connecting-IP" => "8.8.8.8/../../admin?x=" }

      expect(response).to(have_http_status(:no_content))
      expect(link.page_link_clicks.last.ip_address).not_to(include("admin"))
    end

    it "skips the geo lookup for anything that is not an IP" do
      click = link.page_link_clicks.create!(ip_address: "evil.example/../x")
      expect(HTTParty).not_to(receive(:get))

      IpaddrJob.perform_now(click.id, model: "PageLinkClick")
    end
  end

  describe "QR code SVGs" do
    it "are served with a script-blocking CSP" do
      get "/api/me/pages/#{page.id}/qr_code", headers: auth_headers

      expect(response.headers["Content-Security-Policy"]).to(include("default-src 'none'", "sandbox"))
      expect(response.headers["X-Content-Type-Options"]).to(eq("nosniff"))
      expect(response.body).not_to(match(/<script|\son\w+=/i))
    end
  end

  describe "CORS" do
    it "does not allow credentialed requests from other kurz.fyi subdomains" do
      options "/api/me", headers: {
        "Origin" => "https://blobs.kurz.fyi",
        "Access-Control-Request-Method" => "GET",
      }

      expect(response.headers["Access-Control-Allow-Origin"]).to(be_nil)
    end

    it "allows the app origin with credentials" do
      options "/api/me", headers: {
        "Origin" => "https://app.kurz.fyi",
        "Access-Control-Request-Method" => "GET",
      }

      expect(response.headers["Access-Control-Allow-Origin"]).to(eq("https://app.kurz.fyi"))
      expect(response.headers["Access-Control-Allow-Credentials"]).to(eq("true"))
    end
  end
end
