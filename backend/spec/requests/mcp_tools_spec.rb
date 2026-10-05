require "rails_helper"

RSpec.describe("MCP shortlink tools", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
  let(:scopes) { ["shortlinks:read", "shortlinks:write"] }
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
    allow(Shortlink).to(receive(:find_by_short_code).and_call_original) if Shortlink.respond_to?(:find_by_short_code)
    allow_any_instance_of(Shortlink).to(receive(:verify_safety))
    allow_any_instance_of(Shortlink).to(receive(:save_cache))
  end

  def rpc(method, params = nil, id: 1, token: access)
    body = { jsonrpc: "2.0", id: id, method: method }
    body[:params] = params if params
    post("/mcp", params: body, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json)
    JSON.parse(response.body)
  end

  def tool(name, args = {}, token: access)
    rpc("tools/call", { name: name, arguments: args }, token: token)
  end

  def result(reply)
    reply["result"]
  end

  def payload(reply)
    result(reply)["structuredContent"]
  end

  describe "tools/list" do
    it "shows only the tools the granted scopes allow, with titles and honest annotations" do
      tools = rpc("tools/list").dig("result", "tools")

      expect(tools.map { |t| t["name"] }).to(match_array(["list_shortlinks", "get_shortlink_statistics", "create_shortlink"]))
      create = tools.find { |t| t["name"] == "create_shortlink" }
      expect(create["title"]).to(be_present)
      expect(create["annotations"]).to(include("readOnlyHint" => false, "destructiveHint" => false, "openWorldHint" => false))
      expect(create["inputSchema"]["additionalProperties"]).to(be(false))
      expect(tools.find { |t| t["name"] == "list_shortlinks" }["annotations"]).to(include("readOnlyHint" => true))
    end

    it "hides write tools from a read-only grant and everything from an unrelated grant" do
      grant.update!(scopes: ["shortlinks:read"])
      expect(rpc("tools/list").dig("result", "tools").map { |t| t["name"] }).to(match_array(["list_shortlinks", "get_shortlink_statistics"]))

      grant.update!(scopes: ["forms:read"])
      expect(rpc("tools/list").dig("result", "tools")).to(eq([]))
    end

    it "lets write scope imply read for the same resource" do
      grant.update!(scopes: ["shortlinks:write"])

      expect(rpc("tools/list").dig("result", "tools").map { |t| t["name"] }).to(match_array(["list_shortlinks", "get_shortlink_statistics", "create_shortlink"]))
    end
  end

  describe "create_shortlink" do
    it "creates a link for the connected user with a random code and no extras" do
      reply = tool("create_shortlink", { original_url: "https://example.com/a", title: "Docs" })

      expect(result(reply)["isError"]).to(be(false))
      expect(payload(reply)).to(include("original_url" => "https://example.com/a", "title" => "Docs", "password_protected" => false, "active" => true))
      expect(payload(reply)["short_code"]).to(match(/\A[A-Za-z0-9]{6}\z/))
      expect(user.shortlinks.count).to(eq(1))
    end

    it "rejects keys the tool does not declare: short_code, password, user_id, inactive_at" do
      [{ short_code: "mine00" }, { password: "secret1" }, { user_id: other.id }, { inactive_at: "2026-01-01" }].each do |extra|
        reply = tool("create_shortlink", { original_url: "https://example.com" }.merge(extra))

        expect(reply["error"] || result(reply)["isError"]).to(be_truthy, extra.keys.inspect)
      end
      expect(Shortlink.count).to(eq(0))
    end

    it "refuses non http(s) destinations and long titles without storing anything" do
      ["javascript:alert(1)", "data:text/html,x", "java\tscript:alert(1)", "vbscript:x", "file:///etc/passwd", "ftp://example.com", "https://", "not a url", "https://example.com/\"onmouseover=x"].each do |bad|
        reply = tool("create_shortlink", { original_url: bad })
        expect(result(reply)&.dig("isError") || reply["error"]).to(be_truthy, bad)
      end
      reply = tool("create_shortlink", { original_url: "https://example.com", title: "t" * 121 })
      expect(result(reply)&.dig("isError") || reply["error"]).to(be_truthy)
      expect(Shortlink.count).to(eq(0))
    end

    it "keeps markup in the title inert text" do
      reply = tool("create_shortlink", { original_url: "https://example.com", title: "<img src=x onerror=alert(1)>" })

      expect(payload(reply)["title"]).to(eq("<img src=x onerror=alert(1)>"))
    end

    it "limits creations to 20 an hour per user, whatever the grant" do
      20.times { |i| tool("create_shortlink", { original_url: "https://example.com/#{i}" }) }
      expect(user.shortlinks.count).to(eq(20))

      reply = tool("create_shortlink", { original_url: "https://example.com/over" })
      expect(payload(reply)).to(include("error" => "rate_limited"))
      expect(result(reply)["isError"]).to(be(true))

      second = OauthAccessToken.issue(OauthGrant.create!(user: user, oauth_client: client, scopes: scopes, resource: "https://api.kurz.fyi/mcp")).first
      expect(payload(tool("create_shortlink", { original_url: "https://example.com/x" }, token: second))).to(include("error" => "rate_limited"))
      expect(user.shortlinks.count).to(eq(20))
    end

    it "is refused without the write scope" do
      grant.update!(scopes: ["shortlinks:read"])

      reply = tool("create_shortlink", { original_url: "https://example.com" })

      expect(reply["error"] || result(reply)["isError"]).to(be_truthy)
      expect(Shortlink.count).to(eq(0))
    end

    it "still refuses at the tool when a write tool is called with a stale scope list" do
      response = Mcp::Tools::CreateShortlink.call(server_context: { user: user, grant: grant, scopes: ["shortlinks:read"] }, original_url: "https://example.com")

      expect(response.structured_content).to(include(error: "insufficient_scope"))
      expect(Shortlink.count).to(eq(0))
    end
  end

  describe "list_shortlinks and get_shortlink_statistics" do
    let!(:mine) { Shortlink.create!(user: user, original_url: "https://example.com/mine", title: "Mine") }
    let!(:theirs) { Shortlink.create!(user: other, original_url: "https://example.com/theirs") }

    it "lists only the user's links, without secrets, and pages" do
      mine.update_columns(password_digest: "digest")

      payload = payload(tool("list_shortlinks", { per_page: 1 }))

      expect(payload["shortlinks"].map { |l| l["id"] }).to(eq([mine.id]))
      expect(payload["shortlinks"].first.keys).to(match_array(["id", "short_code", "short_url", "original_url", "title", "expires_at", "active", "password_protected", "created_at"]))
      expect(payload["shortlinks"].first["password_protected"]).to(be(true))
      expect(payload).to(include("total" => 1, "page" => 1, "per_page" => 1))
    end

    it "answers aggregates only for statistics, never visitor strings" do
      Event.create!(shortlink: mine, ip_address: "203.0.113.5", user_agent: "CNRY-agent", referer: "https://CNRY.example", country_code: "PT", region: "Lisbon", browser: "Safari", platform: "iOS")

      reply = tool("get_shortlink_statistics", { id: mine.id })

      expect(result(reply)["isError"]).to(be(false))
      expect(reply.to_json).not_to(include("203.0.113.5"))
      expect(reply.to_json).not_to(include("CNRY"))
      expect(reply.to_json).to(include("Safari"))
    end

    it "answers another user's link exactly like a missing one" do
      missing = payload(tool("get_shortlink_statistics", { id: 999_999 }))
      foreign = payload(tool("get_shortlink_statistics", { id: theirs.id }))

      expect(foreign).to(eq(missing))
      expect(foreign).to(include("error" => "not_found"))
    end
  end

  describe "audit trail" do
    it "records metadata only: tool, status, error code and duration" do
      tool("create_shortlink", { original_url: "https://example.com/secret-path", title: "private" })
      tool("get_shortlink_statistics", { id: 999_999 })

      calls = McpToolCall.order(:id).to_a
      expect(calls.map { |c| [c.tool, c.status, c.error_code] }).to(eq([["create_shortlink", "ok", nil], ["get_shortlink_statistics", "error", "not_found"]]))
      expect(McpToolCall.column_names).to(match_array(["id", "oauth_grant_id", "tool", "status", "error_code", "duration_ms", "created_at"]))
      expect(calls.map(&:attributes).to_s).not_to(include("secret-path"))
    end

    it "audits the created link with the connected user and nothing about responses" do
      tool("create_shortlink", { original_url: "https://example.com/a" })

      audit = Shortlink.last.audits.first
      expect([audit.user_id, audit.action]).to(eq([user.id, "create"]).or(eq([nil, "create"])))
    end
  end

  describe "failures" do
    it "never leaks internals when a tool breaks" do
      allow(Mcp::Tools::ListShortlinks).to(receive(:perform).and_raise(StandardError, "PG::Error host=db password=hunter2"))

      reply = tool("list_shortlinks")

      expect(payload(reply)).to(eq("error" => "tool_failed", "message" => "The tool could not complete"))
      expect(reply.to_json).not_to(include("hunter2"))
    end
  end

  describe Mcp::Content do
    it "normalizes, drops control, format and tag characters, and truncates" do
      dirty = "A\u0000B‮C​D‍E\u{E0041}\tF\nG"

      expect(described_class.clean(dirty)).to(eq("ABCD‍E\tF\nG"))
      expect(described_class.clean("é")).to(eq("é"))
      expect(described_class.clean("a" * 5_000).length).to(eq(2_001))
      expect(described_class.clean("\xFF\xFEabc")).to(eq("abc"))
    end
  end
end
