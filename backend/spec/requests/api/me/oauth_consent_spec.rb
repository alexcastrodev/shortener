require "rails_helper"

RSpec.describe("OAuth consent API", type: :request) do
  include_context "authenticated user"

  let(:redirect) { "https://claude.ai/api/mcp/auth_callback" }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: [redirect]) }
  let(:verifier) { SecureRandom.urlsafe_base64(48) }
  let(:challenge) { Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(verifier), padding: false) }
  let(:params) do
    { client_id: client.client_id, redirect_uri: redirect, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", scope: "forms:read responses:read", state: "st&te=1" }
  end
  let(:xhr) { { "X-Requested-With" => "XMLHttpRequest" } }

  def json
    JSON.parse(response.body)
  end

  def location_params
    Rack::Utils.parse_query(URI.parse(json["redirect_to"]).query)
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

  describe "preview" do
    it "describes the client, redirect host, scopes and signed in e-mail" do
      get "/api/me/oauth/authorization", params: params, headers: auth_headers

      expect(response).to(have_http_status(:ok))
      expect(json).to(eq("client" => { "name" => "Claude", "redirect_host" => "claude.ai" }, "scopes" => ["forms:read", "responses:read"], "email" => current_user.email, "resource" => "https://api.kurz.fyi/mcp"))
    end

    it "never redirects for an unknown client or a redirect URI that is not registered" do
      get "/api/me/oauth/authorization", params: params.merge(client_id: "nope"), headers: auth_headers
      expect([response.status, json]).to(eq([400, { "error" => "invalid_client" }]))

      ["https://claude.ai/api/mcp/auth_callback/", "https://evil.example/cb", "//evil.example", "javascript:alert(1)", ""].each do |bad|
        get "/api/me/oauth/authorization", params: params.merge(redirect_uri: bad), headers: auth_headers
        expect([response.status, json["error"], json.key?("redirect_to")]).to(eq([400, "invalid_redirect_uri", false]), bad)
      end
    end

    it "answers other errors by redirecting to the registered URI with state and iss" do
      {
        response_type: "token", code_challenge_method: "plain", code_challenge: "short", scope: "admin", resource: "https://api.kurz.fyi/other",
      }.each do |key, value|
        get "/api/me/oauth/authorization", params: params.merge(key => value), headers: auth_headers
        expect(response).to(have_http_status(:bad_request), key.to_s)
        target = URI.parse(json["redirect_to"])
        expect("#{target.scheme}://#{target.host}#{target.path}").to(eq(redirect))
        expect(location_params).to(include("state" => "st&te=1", "iss" => "https://api.kurz.fyi"))
        expect(location_params["error"]).to(be_present)
      end
    end
  end

  describe "decision" do
    def decide(decision, extra = {})
      post("/api/me/oauth/authorization", params: params.merge(decision: decision).merge(extra), headers: auth_headers.merge(xhr), as: :json)
    end

    it "requires the CSRF header with a cookie session" do
      post "/api/me/oauth/authorization", params: params.merge(decision: "allow", granted_scopes: ["forms:read"]), headers: { "Cookie" => "kurz_session=#{auth_token}" }, as: :json

      expect(response).to(have_http_status(:forbidden))
      expect(OauthGrant.count).to(eq(0))
    end

    it "refuses to grant reading responses together with publishing, and grants either alone" do
      wide = params.merge(scope: "forms:read responses:read forms:publish")

      post("/api/me/oauth/authorization", params: wide.merge(decision: "allow", granted_scopes: ["responses:read", "forms:publish"]), headers: auth_headers.merge(xhr), as: :json)
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["error"]).to(eq("conflicting_scopes"))
      expect(OauthGrant.count).to(eq(0))

      post("/api/me/oauth/authorization", params: wide.merge(decision: "allow", granted_scopes: ["forms:read", "forms:publish"]), headers: auth_headers.merge(xhr), as: :json)
      expect(response).to(have_http_status(:ok))
      expect(OauthGrant.last.scopes).to(eq(["forms:read", "forms:publish"]))
    end

    it "creates a grant with only the scopes the user left on, and redirects with a one-time code, state and iss" do
      decide("allow", granted_scopes: ["forms:read"])

      expect(response).to(have_http_status(:ok))
      expect(location_params).to(include("state" => "st&te=1", "iss" => "https://api.kurz.fyi"))
      expect(location_params["code"]).to(start_with("kz_ac_"))
      grant = OauthGrant.last
      expect([grant.user, grant.scopes, grant.resource]).to(eq([current_user, ["forms:read"], "https://api.kurz.fyi/mcp"]))
      expect(OauthAuthorizationCode.redeem(location_params["code"]).oauth_grant).to(eq(grant))
    end

    it "never grants a scope that was not requested, and denies when nothing is left" do
      decide("allow", granted_scopes: ["forms:write", "pages:write"])

      expect(location_params["error"]).to(eq("access_denied"))
      expect(OauthGrant.count).to(eq(0))
    end

    it "answers access_denied on deny, with state and iss, and creates nothing" do
      decide("deny", granted_scopes: ["forms:read"])

      expect(location_params).to(include("error" => "access_denied", "state" => "st&te=1", "iss" => "https://api.kurz.fyi"))
      expect(location_params).not_to(have_key("code"))
      expect([OauthGrant.count, OauthAuthorizationCode.count]).to(eq([0, 0]))
    end

    it "revalidates everything: a tampered redirect URI is refused" do
      decide("allow", granted_scopes: ["forms:read"], redirect_uri: "https://evil.example/cb")

      expect(response).to(have_http_status(:bad_request))
      expect(OauthGrant.count).to(eq(0))
    end

    it "keeps a loopback redirect URI with its port and a query intact" do
      loopback = OauthClient.create!(client_name: "CLI", redirect_uris: ["http://127.0.0.1:3000/cb?x=1"])
      post "/api/me/oauth/authorization", params: params.merge(client_id: loopback.client_id, redirect_uri: "http://127.0.0.1:55555/cb?x=1", decision: "allow", granted_scopes: ["forms:read"]), headers: auth_headers.merge(xhr), as: :json

      target = URI.parse(json["redirect_to"])
      expect([target.host, target.port, target.path]).to(eq(["127.0.0.1", 55_555, "/cb"]))
      expect(Rack::Utils.parse_query(target.query)).to(include("x" => "1", "code" => a_string_starting_with("kz_ac_")))
    end
  end

  describe "connected apps" do
    let!(:grant) { OauthGrant.create!(user: current_user, oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp") }
    let(:other) { FactoryBot.create(:user) }

    it "lists only the user's active grants without any secret" do
      OauthGrant.create!(user: other, oauth_client: client, scopes: ["forms:read"], resource: "r")
      OauthGrant.create!(user: current_user, oauth_client: client, scopes: ["forms:read"], resource: "r", revoked_at: Time.current)

      get "/api/me/oauth_grants", headers: auth_headers

      expect(json["oauth_grant"].size).to(eq(1))
      expect(json["oauth_grant"].first.keys).to(match_array(["id", "client_name", "redirect_host", "scopes", "connected_at", "last_used_at"]))
    end

    it "revokes at once, and another user's grant is a 404" do
      access, = OauthAccessToken.issue(grant)

      delete "/api/me/oauth_grants/#{grant.id}", headers: auth_headers.merge(xhr)

      expect(response).to(have_http_status(:no_content))
      expect(OauthAccessToken.authenticate(access)).to(be_nil)

      theirs = OauthGrant.create!(user: other, oauth_client: client, scopes: ["forms:read"], resource: "r")
      delete "/api/me/oauth_grants/#{theirs.id}", headers: auth_headers.merge(xhr)
      expect(response).to(have_http_status(:not_found))
      expect(theirs.reload).to(be_active)
    end

    it "requires authentication" do
      get "/api/me/oauth_grants"
      expect(response).to(have_http_status(:unauthorized))
    end
  end
end
