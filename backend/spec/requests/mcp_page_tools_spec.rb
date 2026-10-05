require "rails_helper"

RSpec.describe("MCP bio page tools", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
  let(:scopes) { ["pages:read", "pages:write"] }
  let(:grant) { OauthGrant.create!(user: user, oauth_client: client, scopes: scopes, resource: "https://api.kurz.fyi/mcp") }
  let(:access) { OauthAccessToken.issue(grant).first }
  let(:accept) { { "Accept" => "application/json, text/event-stream" } }

  around do |example|
    ENV["MCP_ENABLED"] = "true"
    example.run
  ensure
    ENV.delete("MCP_ENABLED")
  end

  before do
    host! "localhost"
    allow_any_instance_of(PageLink).to(receive(:verify_safety))
  end

  def tool(name, args = {}, token: access)
    post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json)
    JSON.parse(response.body)
  end

  def data(reply)
    reply.dig("result", "structuredContent")
  end

  def failed?(reply)
    reply["error"].present? || reply.dig("result", "isError") == true
  end

  def snapshot(page)
    [page.reload.attributes, page.page_links.reload.map(&:attributes)]
  end

  describe "create_page" do
    it "always creates an unpublished draft and points to the dashboard" do
      reply = tool("create_page", { slug: "my-draft", display_title: "Mine", theme: "ocean" })

      expect(failed?(reply)).to(be(false))
      expect(data(reply)).to(include("published" => false, "slug" => "my-draft", "theme" => "ocean"))
      expect(data(reply)["dashboard_url"]).to(end_with("/app/pages/#{data(reply)["id"]}"))
      expect(data(reply)["note"]).to(include("Publish it from the dashboard"))
      expect(Page.find(data(reply)["id"]).published).to(be(false))
    end

    it "refuses published, expires_at and every key outside the schema, creating nothing" do
      [{ published: true }, { expires_at: "2030-01-01T00:00:00Z" }, { user_id: other.id }, { avatar_url: "https://x.example/a.png" }].each do |extra|
        expect(failed?(tool("create_page", { slug: "nope-page" }.merge(extra)))).to(be(true), extra.keys.inspect)
      end
      expect(Page.unscoped.count).to(eq(0))
    end

    it "validates the address: format, reserved words, duplicates" do
      ["a", "Has Space", "admin", "login", "x" * 31, "UPPER_CASE!", "../etc"].each do |bad|
        expect(failed?(tool("create_page", { slug: bad }))).to(be(true), bad)
      end
      tool("create_page", { slug: "taken-slug" })
      expect(failed?(tool("create_page", { slug: "taken-slug" }))).to(be(true))
      expect(Page.count).to(eq(1))
    end

    it "builds from a built-in template as a draft, and from the user's own template" do
      reply = tool("create_page", { slug: "from-template", template: "creator" })

      expect(data(reply)["published"]).to(be(false))
      expect(data(reply)["links"].size).to(eq(BuiltInPageTemplates.find("creator")["items"].size))
      expect(data(reply)["links"].map { |l| l["active"] }).to(include(false))

      mine = PageTemplate.create!(user: user, name: "Mine", description: "d", theme: "forest", items: [{ "kind" => "header", "label" => "Hi", "url" => nil, "icon" => nil, "active" => true }])
      reply = tool("create_page", { slug: "from-custom", template: "custom-#{mine.id}" })
      expect([data(reply)["theme"], data(reply)["links"].size]).to(eq(["forest", 1]))
    end

    it "refuses community templates and other users' templates, creating no page" do
      theirs = PageTemplate.create!(user: other, name: "T", description: "d", theme: "forest", items: [], visibility: "public")

      ["community-#{theirs.id}", "custom-#{theirs.id}", "nope"].each do |id|
        expect(failed?(tool("create_page", { slug: "tpl-test", template: id }))).to(be(true), id)
      end
      expect(Page.count).to(eq(0))
    end

    it "allows 10 an hour per user" do
      10.times { |i| tool("create_page", { slug: "page-#{i}-ok" }) }
      expect(Page.count).to(eq(10))

      reply = tool("create_page", { slug: "page-over" })

      expect(data(reply)).to(include("error" => "rate_limited"))
      expect(Page.count).to(eq(10))
    end
  end

  describe "editing: drafts only" do
    let!(:draft) { Page.create!(user: user, slug: "draft-page", published: false) }
    let!(:live) { Page.create!(user: user, slug: "live-page", published: true, bio: "live bio") }
    let!(:live_link) { live.page_links.create!(kind: "link", label: "Live", url: "https://example.com/live") }
    let!(:draft_link) { draft.page_links.create!(kind: "link", label: "One", url: "https://example.com/1") }

    it "edits a draft: fields, links, order and template" do
      expect(data(tool("update_page", { id: draft.id, display_title: "New", bio: "Hello", theme: "paper" }))).to(include("display_title" => "New", "bio" => "Hello", "theme" => "paper"))

      added = data(tool("add_page_link", { page_id: draft.id, label: "Two", url: "https://example.com/2" }))
      expect(added).to(include("label" => "Two", "kind" => "link"))
      updated = data(tool("update_page_link", { page_id: draft.id, id: added["id"], label: "Two!", url: "https://example.com/two" }))
      expect(updated).to(include("label" => "Two!", "url" => "https://example.com/two"))

      reordered = data(tool("reorder_page_links", { page_id: draft.id, ids: [added["id"], draft_link.id] }))
      expect(reordered["links"].map { |l| l["id"] }).to(eq([added["id"], draft_link.id]))

      expect(data(tool("remove_page_link", { page_id: draft.id, id: added["id"] }))).to(eq("removed" => added["id"]))
      applied = data(tool("apply_page_template", { page_id: draft.id, template: "business" }))
      expect(applied["links"].size).to(eq(BuiltInPageTemplates.find("business")["items"].size))
      expect(draft.reload.published).to(be(false))
    end

    it "changes nothing on a published page, whichever write tool is used" do
      before = snapshot(live)
      calls = [
        ["update_page", { id: live.id, bio: "hacked" }],
        ["add_page_link", { page_id: live.id, label: "x", url: "https://evil.example" }],
        ["update_page_link", { page_id: live.id, id: live_link.id, url: "https://evil.example" }],
        ["remove_page_link", { page_id: live.id, id: live_link.id }],
        ["reorder_page_links", { page_id: live.id, ids: [live_link.id] }],
        ["apply_page_template", { page_id: live.id, template: "creator" }],
      ]

      calls.each do |name, args|
        reply = tool(name, args)
        expect(data(reply)).to(include("error" => "page_published"), name)
      end

      expect(snapshot(live)).to(eq(before))
    end

    it "has no tool that publishes, deletes or unpublishes a page" do
      names = Mcp::Tools.all.map(&:tool_name)

      expect(names.grep(/publish|delete|destroy|unpublish/)).to(be_empty)
      expect(Mcp::Tools::UpdatePage.input_schema_value.to_h[:properties].keys.map(&:to_s)).not_to(include("published", "expires_at"))
    end

    it "refuses unsafe link URLs and bad shapes without storing them" do
      ["javascript:alert(1)", "data:text/html,x", "java\tscript:x", "vbscript:x", "https://", "//evil.example", "https://x.example/\" onclick=\"x"].each do |bad|
        expect(failed?(tool("add_page_link", { page_id: draft.id, label: "x", url: bad }))).to(be(true), bad)
      end
      expect(failed?(tool("add_page_link", { page_id: draft.id, label: "x" }))).to(be(true))
      expect(failed?(tool("add_page_link", { page_id: draft.id, kind: "header", label: "H", url: "https://example.com" }))).to(be(true))
      expect(failed?(tool("add_page_link", { page_id: draft.id, kind: "social", label: "S", url: "https://example.com" }))).to(be(true))
      expect(draft.page_links.count).to(eq(1))
    end

    it "keeps markup in text fields inert" do
      reply = tool("update_page", { id: draft.id, bio: "<script>alert(1)</script>", display_title: "<b>x</b>" })

      expect(data(reply)).to(include("bio" => "<script>alert(1)</script>", "display_title" => "<b>x</b>"))
    end

    it "refuses a reorder that is not a permutation, changing nothing" do
      before = snapshot(draft)

      [[], [draft_link.id, draft_link.id], [draft_link.id, 0], [999_999]].each do |ids|
        expect(failed?(tool("reorder_page_links", { page_id: draft.id, ids: ids }))).to(be(true), ids.inspect)
      end
      expect(snapshot(draft)).to(eq(before))
    end

    it "answers another user's page and link exactly like missing ones" do
      theirs = Page.create!(user: other, slug: "their-page", published: false)
      their_link = theirs.page_links.create!(kind: "link", label: "T", url: "https://example.com/t")
      before = snapshot(theirs)

      [
        ["get_page", { id: theirs.id }, { id: 999_999 }],
        ["update_page", { id: theirs.id, bio: "x" }, { id: 999_999, bio: "x" }],
        ["remove_page_link", { page_id: theirs.id, id: their_link.id }, { page_id: 999_999, id: their_link.id }],
        ["update_page_link", { page_id: draft.id, id: their_link.id, label: "x" }, { page_id: draft.id, id: 999_999, label: "x" }],
      ].each do |name, foreign, missing|
        expect(data(tool(name, foreign))).to(eq(data(tool(name, missing))), name)
      end
      expect(snapshot(theirs)).to(eq(before))
    end
  end

  describe "reading" do
    let!(:page) { Page.create!(user: user, slug: "reading-page", published: true) }

    it "lists and shows the user's pages with their links" do
      page.page_links.create!(kind: "link", label: "A", url: "https://example.com/a")
      Page.create!(user: other, slug: "not-mine-page")

      expect(data(tool("list_pages"))["pages"].map { |p| p["slug"] }).to(eq(["reading-page"]))
      expect(data(tool("get_page", { id: page.id }))["links"].map { |l| l["label"] }).to(eq(["A"]))
    end

    it "lists built-in and own templates, never community ones" do
      PageTemplate.create!(user: other, name: "Community one", description: "d", theme: "forest", items: [], visibility: "public")
      mine = PageTemplate.create!(user: user, name: "Mine", description: "d", theme: "forest", items: [])

      ids = data(tool("list_page_templates"))["templates"].map { |t| t["id"] }

      expect(ids).to(include("creator", "custom-#{mine.id}"))
      expect(ids.grep(/community/)).to(be_empty)
      expect(data(tool("list_page_templates"))["templates"].map { |t| t["name"] }).not_to(include("Community one"))
    end

    it "gives statistics as aggregates, never a visitor string" do
      link = page.page_links.create!(kind: "link", label: "A", url: "https://example.com/a")
      PageLinkClick.create!(page_link: link, ip_address: "203.0.113.9", user_agent: "CNRY-agent", referer: "https://CNRY.example/x", country_code: "PT", platform: "iOS", browser: "Safari", clicked_at: Time.current)

      reply = tool("get_page_statistics", { id: page.id, days: 7 })

      expect(failed?(reply)).to(be(false))
      expect(reply.to_json).not_to(include("203.0.113.9"))
      expect(reply.to_json).not_to(include("CNRY-agent"))
      expect(reply.to_json).to(include("Safari"))
    end
  end

  describe "scopes" do
    it "hides write tools from a read-only grant and everything from a shortlinks-only grant" do
      grant.update!(scopes: ["pages:read"])
      names = ->(token) { post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/list" }, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json) && JSON.parse(response.body).dig("result", "tools").map { |t| t["name"] } }

      expect(names.call(access)).to(match_array(["list_pages", "get_page", "get_page_statistics", "list_page_templates"]))
      grant.update!(scopes: ["shortlinks:read"])
      expect(names.call(access)).to(match_array(["list_shortlinks", "get_shortlink_statistics"]))
    end
  end
end
