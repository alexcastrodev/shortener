require "rails_helper"

RSpec.describe(PurgeMcpToolCallsJob) do
  let(:grant) do
    client = OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"])
    OauthGrant.create!(user: FactoryBot.create(:user), oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp")
  end

  it "deletes calls older than 90 days and keeps recent ones" do
    old = McpToolCall.create!(oauth_grant: grant, tool: "list_forms", status: "ok", created_at: 91.days.ago)
    recent = McpToolCall.create!(oauth_grant: grant, tool: "list_forms", status: "ok", created_at: 89.days.ago)

    described_class.perform_now

    expect(McpToolCall.all).to(contain_exactly(recent))
    expect(McpToolCall.exists?(old.id)).to(be(false))
  end
end
