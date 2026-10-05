require "rails_helper"

RSpec.describe("POST /mcp", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
  let(:grant) { OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp") }
  let(:access) { OauthAccessToken.issue(grant).first }
  let(:accept) { { "Accept" => "application/json, text/event-stream" } }
  let(:rpc) { { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "spec", version: "1" } } } }

  def json
    JSON.parse(response.body)
  end

  def call(body = rpc, token: access, headers: {})
    post("/mcp", params: body, headers: accept.merge(token ? { "Authorization" => "Bearer #{token}" } : {}).merge(headers), as: :json)
  end

  around do |example|
    ENV["MCP_ENABLED"] = "true"
    example.run
  ensure
    ENV.delete("MCP_ENABLED")
  end

  before do
    host! "localhost"
  end

  it "answers 404 while the feature flag is off" do
    ENV.delete("MCP_ENABLED")

    call

    expect(response).to(have_http_status(:not_found))
  end

  describe "challenge" do
    it "answers 401 with a WWW-Authenticate pointing at the resource metadata and every scope" do
      call(token: nil)

      expect(response).to(have_http_status(:unauthorized))
      challenge = response.headers["WWW-Authenticate"]
      expect(challenge).to(start_with("Bearer resource_metadata=\"https://api.kurz.fyi/.well-known/oauth-protected-resource/mcp\""))
      OauthGrant::SCOPES.each { |scope| expect(challenge).to(include(scope)) }
      expect(challenge).not_to(include("invalid_token"))
      expect(response.headers["Cache-Control"]).to(eq("no-store"))
    end

    it "adds error=invalid_token when a credential was presented" do
      call(token: "garbage")

      expect(response).to(have_http_status(:unauthorized))
      expect(response.headers["WWW-Authenticate"]).to(include("invalid_token"))
    end

    it "refuses every other way of sending a token, and every other kind of token" do
      token = access
      post "/mcp?access_token=#{token}", params: rpc, headers: accept, as: :json
      expect(response).to(have_http_status(:unauthorized))
      post "/mcp", params: rpc.merge(access_token: token), headers: accept, as: :json
      expect(response).to(have_http_status(:unauthorized))
      call(token: nil, headers: { "Authorization" => "Basic #{Base64.strict_encode64("a:b")}" })
      expect(response).to(have_http_status(:unauthorized))
      call(token: nil, headers: { "Cookie" => "kurz_session=#{SessionToken.issue(user)}" })
      expect(response).to(have_http_status(:unauthorized))
      call(token: SessionToken.issue(user))
      expect(response).to(have_http_status(:unauthorized))
      call(token: OauthRefreshToken.issue(grant))
      expect(response).to(have_http_status(:unauthorized))
      call(token: token.sub("kz_at_", "kz_ac_"))
      expect(response).to(have_http_status(:unauthorized))
    end

    it "refuses an expired token, a revoked grant, another resource, a deactivated user and a signed-out session" do
      token = access
      travel_to(2.hours.from_now) { call(token: token) }
      expect(response).to(have_http_status(:unauthorized))

      other = OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/other")
      call(token: OauthAccessToken.issue(other).first)
      expect(response).to(have_http_status(:unauthorized))

      user.update!(sessions_revoked_at: 1.minute.from_now)
      call(token: token)
      expect(response).to(have_http_status(:unauthorized))
      user.update!(sessions_revoked_at: nil)

      user.update!(deactivated_at: Time.current)
      call(token: token)
      expect(response).to(have_http_status(:unauthorized))
      user.update!(deactivated_at: nil)

      grant.revoke!
      call(token: token)
      expect(response).to(have_http_status(:unauthorized))
    end

    it "takes effect on the very next call when the grant is revoked" do
      token = access
      call(token: token)
      expect(response).to(have_http_status(:ok))

      grant.revoke!
      call(token: token)

      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "protocol" do
    it "initializes, lists only the tools the grant may use, sends no cookie and stays no-store" do
      call
      expect(response).to(have_http_status(:ok))
      expect(json.dig("result", "serverInfo", "name")).to(eq("kurz"))
      expect(response.headers["Set-Cookie"]).to(be_nil)
      expect(response.headers["Cache-Control"]).to(eq("no-store"))

      call({ jsonrpc: "2.0", id: 2, method: "tools/list" })
      expect(json.dig("result", "tools").map { |t| t["name"] }).to(match_array(["list_forms", "get_form", "list_form_templates"]))
    end

    it "answers an unknown method with a JSON-RPC error, never a 5xx" do
      call({ jsonrpc: "2.0", id: 3, method: "nope/nope" })

      expect(response.status).to(be < 500)
      expect(json["error"]).to(be_present)
    end

    it "never answers 5xx for odd bodies" do
      [{}, [], { jsonrpc: "1.0" }, { jsonrpc: "2.0", method: 5 }, { jsonrpc: "2.0", id: { a: 1 }, method: "initialize" }, "[]"].each do |body|
        call(body)
        expect(response.status).to(be < 500, body.inspect)
      end
      post "/mcp", params: "{not json", headers: accept.merge("Authorization" => "Bearer #{access}", "Content-Type" => "application/json")
      expect(response.status).to(be < 500)
    end

    it "refuses bodies over 256 KiB" do
      call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { pad: "a" * 300_000 } })

      expect(response.status).to(be_in([400, 413]))
    end

    it "does not take a hostile Origin" do
      call(headers: { "Origin" => "https://evil.example" })

      expect(response).to(have_http_status(:forbidden))
    end

    it "refuses sessions and the stream: stateless only" do
      get "/mcp", headers: accept.merge("Authorization" => "Bearer #{access}")
      expect(response.status).to(be_in([400, 405, 406]))
    end
  end

  describe "isolation from the rest of the API" do
    it "does not let an OAuth token act as a session on /api" do
      get "/api/me/forms", headers: { "Authorization" => "Bearer #{access}" }

      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "rate limit" do
    it "answers 429 after 120 calls a minute for one grant, and not for another" do
      token = access
      120.times { call(token: token) }
      expect(response).to(have_http_status(:ok))

      call(token: token)
      expect(response).to(have_http_status(:too_many_requests))

      other = OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp")
      call(token: OauthAccessToken.issue(other).first)
      expect(response).to(have_http_status(:ok))
    end
  end
end
