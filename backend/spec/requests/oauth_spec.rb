require "rails_helper"

RSpec.describe("OAuth authorization server", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:redirect) { "https://claude.ai/api/mcp/auth_callback" }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: [redirect]) }
  let(:grant) { OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:read", "pages:read"], resource: "https://api.kurz.fyi/mcp") }
  let(:verifier) { SecureRandom.urlsafe_base64(48) }
  let(:challenge) { Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(verifier), padding: false) }
  let(:form_headers) { { "Content-Type" => "application/x-www-form-urlencoded" } }
  def json
    JSON.parse(response.body)
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

  def issue_code(redirect_uri: redirect)
    OauthAuthorizationCode.issue(grant: grant, code_challenge: challenge, redirect_uri: redirect_uri)
  end

  def exchange(params = {})
    code = params.key?(:code) ? params[:code] : issue_code
    post("/oauth/token", params: { grant_type: "authorization_code", code: code, redirect_uri: redirect, client_id: client.client_id, code_verifier: verifier }.merge(params.except(:code)), headers: form_headers)
  end

  describe "feature flag" do
    it "answers 404 everywhere while MCP_ENABLED is off" do
      ENV.delete("MCP_ENABLED")

      [[:get, "/.well-known/oauth-protected-resource"], [:get, "/.well-known/oauth-authorization-server"], [:post, "/oauth/register"], [:post, "/oauth/token"], [:post, "/oauth/revoke"]].each do |verb, path|
        send(verb, path)
        expect(response).to(have_http_status(:not_found), path)
      end
    end
  end

  describe "metadata" do
    it "publishes the protected resource (RFC 9728) from config, never from the Host header" do
      get "/.well-known/oauth-protected-resource", headers: { "Host" => "evil.example", "X-Forwarded-Host" => "evil.example" }

      expect(json).to(include("resource" => "https://api.kurz.fyi/mcp", "authorization_servers" => ["https://api.kurz.fyi"], "bearer_methods_supported" => ["header"]))
      expect(json["scopes_supported"]).to(match_array(OauthGrant::SCOPES))
      get "/.well-known/oauth-protected-resource/mcp"
      expect(json["resource"]).to(eq("https://api.kurz.fyi/mcp"))
    end

    it "publishes the authorization server (RFC 8414) with S256 only and the iss parameter" do
      get "/.well-known/oauth-authorization-server", headers: { "X-Forwarded-Host" => "evil.example" }

      expect(json).to(include(
        "issuer" => "https://api.kurz.fyi",
        "token_endpoint" => "https://api.kurz.fyi/oauth/token",
        "registration_endpoint" => "https://api.kurz.fyi/oauth/register",
        "code_challenge_methods_supported" => ["S256"],
        "grant_types_supported" => ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported" => ["none"],
        "authorization_response_iss_parameter_supported" => true,
      ))
      expect(json["authorization_endpoint"]).to(end_with("/oauth/authorize"))
      expect(response.headers["Cache-Control"]).to(eq("no-store"))
    end
  end

  describe "dynamic client registration" do
    def register(body)
      post("/oauth/register", params: body, as: :json)
    end

    it "registers a public client with an allowed redirect URI" do
      register({ client_name: "Claude", redirect_uris: [redirect], token_endpoint_auth_method: "none" })

      expect(response).to(have_http_status(:created))
      expect(json).to(include("client_name" => "Claude", "redirect_uris" => [redirect], "token_endpoint_auth_method" => "none"))
      expect(OauthClient.find_by(client_id: json["client_id"])).to(be_present)
    end

    it "refuses redirect URIs that are not allowed, secrets and unknown grants" do
      register({ client_name: "x", redirect_uris: ["https://evil.example/cb"] })
      expect([response.status, json["error"]]).to(eq([400, "invalid_redirect_uri"]))
      register({ client_name: "x", redirect_uris: "https://claude.ai/cb" })
      expect(json["error"]).to(eq("invalid_redirect_uri"))
      register({ client_name: "x", redirect_uris: [redirect], token_endpoint_auth_method: "client_secret_basic" })
      expect(json["error"]).to(eq("invalid_client_metadata"))
      register({ client_name: "x", redirect_uris: [redirect], grant_types: ["implicit"] })
      expect(json["error"]).to(eq("invalid_client_metadata"))
      expect(OauthClient.count).to(eq(0))
    end

    it "keeps hostile names as inert text, without control or bidi characters" do
      register({ client_name: "<script>alert(1)</script>‮\u0007Claude", redirect_uris: [redirect] })

      expect(OauthClient.last.client_name).to(eq("<script>alert(1)</script>Claude"))
      register({ client_name: "n" * 500, redirect_uris: [redirect] })
      expect(response).to(have_http_status(:bad_request))
    end

    it "refuses non-JSON, huge and over-limit registrations" do
      post "/oauth/register", params: "client_name=x", headers: form_headers
      expect(response).to(have_http_status(:unsupported_media_type))
      register({ client_name: "x", redirect_uris: [redirect], pad: "a" * 6_000 })
      expect(response).to(have_http_status(:payload_too_large))
      register({ client_name: "x", redirect_uris: [redirect] * 6 })
      expect(response).to(have_http_status(:bad_request))
    end

    it "limits registrations per IP" do
      10.times { register({ client_name: "x", redirect_uris: [redirect] }) }
      register({ client_name: "x", redirect_uris: [redirect] })

      expect(response).to(have_http_status(:too_many_requests))
      expect(json["error"]).to(eq("temporarily_unavailable"))
    end
  end

  describe "token: authorization_code" do
    it "exchanges a valid code and answers no-store, with tokens only as digests in the database" do
      exchange

      expect(response).to(have_http_status(:ok))
      expect(json).to(include("token_type" => "Bearer", "expires_in" => 3600, "scope" => "forms:read pages:read"))
      expect(json["access_token"]).to(start_with("kz_at_"))
      expect(json["refresh_token"]).to(start_with("kz_rt_"))
      expect(response.headers["Cache-Control"]).to(eq("no-store"))
      expect(response.headers["Pragma"]).to(eq("no-cache"))
      expect(OauthAccessToken.pluck(:token_digest)).to(eq([Oauth::Tokens.digest(json["access_token"])]))
    end

    it "refuses a wrong, short, long or missing verifier, and a plain challenge" do
      code = issue_code
      ["wrong" * 12, "short", "a" * 200, "", nil].each do |bad|
        exchange(code: issue_code, code_verifier: bad)
        expect([response.status, json["error"]]).to(eq([400, "invalid_grant"]), bad.inspect[0, 20])
      end
      expect(code).to(be_present)
      expect(OauthAccessToken.count).to(eq(0))
    end

    it "refuses another client, another redirect URI and another resource" do
      other = OauthClient.create!(client_name: "Other", redirect_uris: ["https://chatgpt.com/connector/oauth/abc"])

      exchange(client_id: other.client_id)
      expect(json["error"]).to(eq("invalid_grant"))
      exchange(redirect_uri: "https://claude.ai/api/mcp/other")
      expect(json["error"]).to(eq("invalid_grant"))
      exchange(resource: "https://api.kurz.fyi/other")
      expect(json["error"]).to(eq("invalid_target"))
      exchange(resource: "https://api.kurz.fyi/mcp")
      expect(response).to(have_http_status(:ok))
    end

    it "accepts a code once; a replay revokes the tokens of the first exchange" do
      code = issue_code
      exchange(code: code)
      access = json["access_token"]
      expect(response).to(have_http_status(:ok))

      exchange(code: code)

      expect(json["error"]).to(eq("invalid_grant"))
      expect(grant.reload).not_to(be_active)
      expect(OauthAccessToken.authenticate(access)).to(be_nil)
    end

    it "refuses expired codes, garbage and other token kinds" do
      expired = issue_code
      travel_to(2.minutes.from_now) { exchange(code: expired) }
      expect(json["error"]).to(eq("invalid_grant"))

      ["", nil, "kz_at_x", "x" * 500].each do |bad|
        exchange(code: bad)
        expect(json["error"]).to(eq("invalid_grant"))
      end
    end

    it "refuses an inactive grant or user, and a session signed out since the grant" do
      user.update!(deactivated_at: Time.current)
      exchange
      expect(json["error"]).to(eq("invalid_grant"))
      user.update!(deactivated_at: nil)

      user.update!(sessions_revoked_at: 1.minute.from_now)
      exchange
      expect(json["error"]).to(eq("invalid_grant"))
    end
  end

  describe "token: refresh_token" do
    def refresh(token, extra = {})
      post("/oauth/token", params: { grant_type: "refresh_token", refresh_token: token, client_id: client.client_id }.merge(extra), headers: form_headers)
    end

    it "rotates: a new pair is issued and the old refresh token is dead" do
      exchange
      first = json["refresh_token"]

      refresh(first)
      expect(response).to(have_http_status(:ok))
      expect(json["refresh_token"]).not_to(eq(first))

      refresh(first)
      expect(json["error"]).to(eq("invalid_grant"))
      expect(grant.reload).not_to(be_active)
    end

    it "revokes everything when an old refresh token is reused" do
      exchange
      old = json["refresh_token"]
      refresh(old)
      newest = json["refresh_token"]
      refresh(old)

      refresh(newest)
      expect(json["error"]).to(eq("invalid_grant"))
    end

    it "never widens the scope and keeps the 90 day ceiling" do
      exchange
      first = json["refresh_token"]

      refresh(first, scope: "forms:read pages:read shortlinks:write")
      expect(json["error"]).to(eq("invalid_scope"))
    end

    it "keeps the absolute expiry across rotations" do
      exchange
      first = json["refresh_token"]
      absolute = OauthRefreshToken.last.absolute_expires_at

      refresh(first)

      expect(OauthRefreshToken.last.absolute_expires_at).to(be_within(1.second).of(absolute))
    end

    it "refuses another client" do
      exchange
      other = OauthClient.create!(client_name: "Other", redirect_uris: ["https://chatgpt.com/connector/oauth/abc"])

      refresh(json["refresh_token"], client_id: other.client_id)

      expect(json["error"]).to(eq("invalid_grant"))
    end
  end

  describe "token endpoint hygiene" do
    it "answers unsupported_grant_type, and 415 for JSON bodies" do
      post "/oauth/token", params: { grant_type: "password" }, headers: form_headers
      expect(json["error"]).to(eq("unsupported_grant_type"))
      post "/oauth/token", params: { grant_type: "authorization_code" }, as: :json
      expect(response).to(have_http_status(:unsupported_media_type))
    end

    it "limits attempts per client, not per IP" do
      60.times { post "/oauth/token", params: { grant_type: "authorization_code", client_id: "c1" }, headers: form_headers }
      post "/oauth/token", params: { grant_type: "authorization_code", client_id: "c1" }, headers: form_headers
      expect(response).to(have_http_status(:too_many_requests))

      post "/oauth/token", params: { grant_type: "authorization_code", client_id: "c2" }, headers: form_headers
      expect(response).to(have_http_status(:bad_request))
    end

    it "does not authenticate a session cookie or token and never sets a cookie" do
      post "/oauth/token", params: { grant_type: "refresh_token" }, headers: form_headers.merge("Cookie" => "kurz_session=#{SessionToken.issue(user)}")

      expect(response.headers["Set-Cookie"]).to(be_nil)
    end
  end

  describe "revocation" do
    def revoke(token)
      post("/oauth/revoke", params: { token: token }, headers: form_headers)
    end

    it "revokes the grant for an access or a refresh token and answers 200 for anything else" do
      exchange
      revoke(json["refresh_token"])
      expect([response.status, grant.reload.active?]).to(eq([200, false]))

      grant.update_column(:revoked_at, nil)
      exchange
      access = json["access_token"]
      revoke(access)
      expect(OauthAccessToken.authenticate(access)).to(be_nil)

      ["garbage", "", "kz_at_unknown", "x" * 500].each do |junk|
        revoke(junk)
        expect(response).to(have_http_status(:ok))
      end
    end
  end

  describe "CORS" do
    it "allows any origin on the token endpoint without credentials, and a cookie never leaks" do
      options "/oauth/token", headers: { "Origin" => "https://claude.ai", "Access-Control-Request-Method" => "POST" }

      expect(response.headers["Access-Control-Allow-Origin"]).to(eq("*"))
      expect(response.headers["Access-Control-Allow-Credentials"]).to(be_nil)
    end

    it "keeps credentials off the origins of the web app for the rest of the API" do
      get "/api/public/pages/x", headers: { "Origin" => "https://evil.example" }
      expect(response.headers["Access-Control-Allow-Origin"]).to(be_nil)
    end
  end
end
