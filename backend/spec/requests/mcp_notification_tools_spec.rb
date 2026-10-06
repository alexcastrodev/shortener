require "rails_helper"

RSpec.describe("MCP notification tools", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
  let(:scopes) { ["appointments:read"] }
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
    allow(ENV).to(receive(:[]).and_call_original)
  end

  def make(owner = user, key: SecureRandom.hex(4))
    Notification.notify_owner(user_id: owner.id, kind: "appointment_created", event_key: key, source: nil, payload: { form_id: 1, sessions: 2 })
  end

  def tool(name, args = {}, token: access)
    post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json)
    JSON.parse(response.body)
  end

  def data(reply) = reply.dig("result", "structuredContent")

  def failed?(reply) = reply["error"].present? || reply.dig("result", "isError") == true

  def listed
    post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/list" }, headers: accept.merge("Authorization" => "Bearer #{access}"), as: :json)
    JSON.parse(response.body).dig("result", "tools").map { |item| item["name"] }
  end

  describe "which tools appear" do
    it "lists only the read tool for appointments:read and both for appointments:write" do
      expect(listed & ["list_notifications", "mark_notification_read"]).to(eq(["list_notifications"]))
      grant.update!(scopes: ["appointments:write"])
      expect(listed & ["list_notifications", "mark_notification_read"]).to(match_array(["list_notifications", "mark_notification_read"]))
    end

    it "refuses to mark a notification with a read-only grant" do
      row = make
      reply = tool("mark_notification_read", { id: row.id })
      expect(failed?(reply)).to(be(true))
      expect(row.reload.read_at).to(be_nil)
    end
  end

  describe "listing" do
    it "returns my notifications newest first with the unread count, ids only" do
      first = make
      second = make
      make(other)
      second.update!(read_at: Time.current)
      reply = data(tool("list_notifications"))
      expect(reply["notifications"].map { |row| row["id"] }).to(eq([second.id, first.id]))
      expect(reply["unread_count"]).to(eq(1))
      expect(reply["notifications"].first).to(include("kind" => "appointment_created", "payload" => { "form_id" => 1, "sessions" => 2 }))
    end

    it "filters unread, pages with a cursor and never counts against the records budget" do
      ids = Array.new(3) { make.id }
      Notification.find(ids.last).update!(read_at: Time.current)
      expect(data(tool("list_notifications", { unread_only: true }))["notifications"].size).to(eq(2))

      page = data(tool("list_notifications", { limit: 1 }))
      expect(page["next_before"]).to(eq(ids.last))
      more = data(tool("list_notifications", { limit: 5, before: page["next_before"] }))
      expect(more["notifications"].map { |row| row["id"] }).to(eq([ids[1], ids[0]]))
      expect(McpToolCall.where(tool: "list_notifications").sum(:records_returned)).to(eq(0))
    end

    it "only sees owner in-app rows, not emails" do
      Notification.create!(channel: "email", kind: "appointment_created", recipient_kind: "owner", user_id: user.id, event_key: "e", payload: {})
      expect(data(tool("list_notifications"))["notifications"]).to(eq([]))
    end

    it "rejects extra arguments and answers for an unavailable account" do
      expect(failed?(tool("list_notifications", { user_id: other.id }))).to(be(true))
    end
  end

  describe "marking as read" do
    let(:scopes) { ["appointments:write"] }

    it "marks one and keeps the first read time on a repeat" do
      row = make
      reply = data(tool("mark_notification_read", { id: row.id }))
      expect(reply).to(include("id" => row.id, "unread_count" => 0))
      first = row.reload.read_at
      expect(first).to(be_present)
      travel_to(1.hour.from_now) { tool("mark_notification_read", { id: row.id }) }
      expect(row.reload.read_at).to(eq(first))
    end

    it "answers not found for someone else's notification and for an unknown id, changing nothing" do
      theirs = make(other)
      expect(data(tool("mark_notification_read", { id: theirs.id }))["error"]).to(eq("not_found"))
      expect(data(tool("mark_notification_read", { id: 0 + 999_999 }))["error"]).to(eq("not_found"))
      expect(theirs.reload.read_at).to(be_nil)
    end

    it "leaves the other notifications unread" do
      one = make
      two = make
      tool("mark_notification_read", { id: one.id })
      expect(two.reload.read_at).to(be_nil)
    end
  end
end
