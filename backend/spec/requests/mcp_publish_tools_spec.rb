require "rails_helper"

RSpec.describe("MCP publish tools", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
  let(:scopes) { ["forms:read", "forms:write", "forms:publish", "pages:read", "pages:write", "pages:publish"] }
  let(:grant) { OauthGrant.create!(user: user, oauth_client: client, scopes: scopes, resource: "https://api.kurz.fyi/mcp") }
  let(:access) { OauthAccessToken.issue(grant).first }
  let(:accept) { { "Accept" => "application/json, text/event-stream" } }
  let(:fields) { [{ "id" => "text0001", "type" => "short_text", "label" => "Q" }] }
  let!(:draft_form) { Form.create!(user: user, title: "Draft", fields: fields) }
  let!(:live_form) { Form.create!(user: user, title: "Live", published: true, fields: fields) }
  let!(:empty_form) { Form.create!(user: user, title: "Empty") }
  let!(:draft_page) { Page.create!(user: user, slug: "draft-page", published: false) }
  let!(:live_page) { Page.create!(user: user, slug: "live-page", published: true, bio: "live bio") }

  around do |example|
    ENV["MCP_ENABLED"] = "true"
    ENV["FRONTEND_URL"] = "https://kurz.fyi"
    example.run
  ensure
    ENV.delete("MCP_ENABLED")
    ENV.delete("FRONTEND_URL")
  end

  before { host! "localhost" }

  def tool(name, args = {}, token: access)
    post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json)
    JSON.parse(response.body)
  end

  def data(reply)
    reply.dig("result", "structuredContent")
  end

  def names_for(token)
    post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/list" }, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json)
    JSON.parse(response.body).dig("result", "tools").map { |entry| entry["name"] }
  end

  describe "forms" do
    it "publishes a form with a question, with its public URL and a short link" do
      reply = tool("publish_form", { id: draft_form.id })

      expect(data(reply)).to(include("published" => true))
      expect(data(reply)["public_url"]).to(end_with("/f/#{draft_form.public_id}"))
      expect(draft_form.reload.published).to(be(true))
      expect(draft_form.shortlink).not_to(be_nil)
    end

    it "refuses a form with no questions and leaves it unpublished" do
      reply = tool("publish_form", { id: empty_form.id })

      expect(data(reply)).to(include("error" => "no_questions"))
      expect(empty_form.reload.published).to(be(false))
    end

    it "unpublishes a form and keeps its responses" do
      FormResponse.create!(form: live_form, answers: { "text0001" => "kept" })

      reply = tool("unpublish_form", { id: live_form.id })

      expect(data(reply)).to(include("published" => false))
      expect(live_form.reload.published).to(be(false))
      expect(live_form.responses.count).to(eq(1))
    end

    it "does not reach forms of other users" do
      theirs = Form.create!(user: other, title: "Theirs", fields: fields)

      expect(data(tool("publish_form", { id: theirs.id }))).to(include("error" => "not_found"))
      expect(theirs.reload.published).to(be(false))
    end
  end

  describe "pages" do
    it "publishes and unpublishes a page" do
      expect(data(tool("publish_page", { id: draft_page.id }))).to(include("published" => true, "public_url" => draft_page.public_url))
      expect(draft_page.reload.published).to(be(true))

      expect(data(tool("unpublish_page", { id: live_page.id }))).to(include("published" => false))
      expect(live_page.reload.published).to(be(false))
    end

    it "does not reach pages of other users" do
      theirs = Page.create!(user: other, slug: "their-page", published: false)

      expect(data(tool("publish_page", { id: theirs.id }))).to(include("error" => "not_found"))
    end
  end

  describe "colors and theme on published items" do
    it "changes only theme and colors of a live form and page, nothing else" do
      colors = { "background" => "#101010", "text" => "#fafafa", "accent" => "#ff5500" }

      expect(data(tool("update_form", { id: live_form.id, theme: "ocean" }))).to(include("theme" => "ocean"))
      expect(data(tool("update_form", { id: live_form.id, custom_colors: colors }))["custom_colors"]).to(eq(colors))
      expect(data(tool("update_page", { id: live_page.id, custom_colors: colors }))["custom_colors"]).to(eq(colors))

      expect(data(tool("update_form", { id: live_form.id, title: "hacked" }))).to(include("error" => "form_published"))
      expect(data(tool("update_form", { id: live_form.id, theme: "forest", title: "hacked" }))).to(include("error" => "form_published"))
      expect(data(tool("update_page", { id: live_page.id, bio: "hacked" }))).to(include("error" => "page_published"))
      expect(data(tool("update_page", { id: live_page.id, slug: "stolen" }))).to(include("error" => "page_published"))
      expect(live_form.reload.title).to(eq("Live"))
      expect(live_page.reload.bio).to(eq("live bio"))
      expect(live_page.slug).to(eq("live-page"))
    end

    it "rejects colors that are not #RRGGBB on a live page" do
      reply = tool("update_page", { id: live_page.id, custom_colors: { background: "red", text: "#fff", accent: "#000000" } })

      expect(reply["error"] || reply.dig("result", "isError")).to(be_truthy)
      expect(live_page.reload.custom_colors).to(be_nil)
    end
  end

  describe "scopes" do
    it "lists the publish tools only with a publish scope" do
      expect(names_for(access)).to(include("publish_form", "unpublish_form", "publish_page", "unpublish_page"))

      writer = OauthAccessToken.issue(OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:read", "forms:write", "pages:read", "pages:write"], resource: "https://api.kurz.fyi/mcp")).first
      expect(names_for(writer).grep(/publish/)).to(be_empty)
    end

    it "does not let a forms-only publish scope publish pages" do
      forms_only = OauthAccessToken.issue(OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:publish"], resource: "https://api.kurz.fyi/mcp")).first

      expect(names_for(forms_only)).to(match_array(["publish_form", "unpublish_form"]))
      reply = tool("publish_page", { id: draft_page.id }, token: forms_only)

      expect(reply["error"] || reply.dig("result", "isError")).to(be_truthy)
      expect(draft_page.reload.published).to(be(false))
    end

    it "never combines publishing with reading responses" do
      ["forms:publish", "pages:publish"].each do |publish|
        grant = OauthGrant.new(user: user, oauth_client: client, scopes: ["responses:read", publish], resource: "https://api.kurz.fyi/mcp")

        expect(grant).not_to(be_valid)
        expect(grant.errors[:scopes].join).to(include("cannot combine"))
      end
    end
  end
end
