require "rails_helper"

RSpec.describe("OAuth consent for the appointments scopes", type: :request) do
  include_context "authenticated user"

  let(:redirect) { "https://claude.ai/api/mcp/auth_callback" }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: [redirect]) }
  let(:challenge) { Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(SecureRandom.urlsafe_base64(48)), padding: false) }
  let(:scope) { "forms:read appointments:read appointments:write forms:publish" }
  let(:params) do
    { client_id: client.client_id, redirect_uri: redirect, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", scope: scope, state: "s" }
  end
  let(:xhr) { { "X-Requested-With" => "XMLHttpRequest" } }

  around do |example|
    ENV["MCP_ENABLED"] = "true"
    example.run
  ensure
    ENV.delete("MCP_ENABLED")
  end

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
  end

  def json
    JSON.parse(response.body)
  end

  def preview
    get("/api/me/oauth/authorization", params: params, headers: auth_headers)
  end

  def allow_scopes(*granted)
    post("/api/me/oauth/authorization", params: params.merge(decision: "allow", granted_scopes: granted), headers: auth_headers.merge(xhr), as: :json)
  end

  describe "preview" do
    it "offers the appointments scopes to an enabled account" do
      preview
      expect(json["scopes"]).to(eq(["forms:read", "appointments:read", "appointments:write", "forms:publish"]))
    end

    it "does not offer them to an account outside the allow-list" do
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ALLOWED_EMAILS").and_return("someone@else.com"))
      preview
      expect(json["scopes"]).to(eq(["forms:read", "forms:publish"]))
    end

    it "refuses the request outright when the feature is off" do
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      preview
      expect(response).to(have_http_status(:bad_request))
      expect(json["error"]).to(eq("invalid_scope"))
    end
  end

  describe "granting" do
    it "grants reading or managing appointments on their own" do
      allow_scopes("forms:read", "appointments:read")
      expect(response).to(have_http_status(:ok))
      expect(OauthGrant.last.scopes).to(eq(["forms:read", "appointments:read"]))

      allow_scopes("appointments:write")
      expect(OauthGrant.last.scopes).to(eq(["appointments:write"]))
    end

    it "refuses personal data together with publishing, for read and for write" do
      ["appointments:read", "appointments:write"].each do |personal|
        allow_scopes(personal, "forms:publish")
        expect(response).to(have_http_status(:unprocessable_entity), personal)
        expect(json["error"]).to(eq("conflicting_scopes"))
      end
      expect(OauthGrant.count).to(eq(0))
    end

    it "drops the appointments scopes for an account that is not allowed, and denies when nothing is left" do
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ALLOWED_EMAILS").and_return("someone@else.com"))
      allow_scopes("forms:read", "appointments:read")
      expect(OauthGrant.last.scopes).to(eq(["forms:read"]))

      allow_scopes("appointments:write")
      expect(json["redirect_to"]).to(include("error=access_denied"))
      expect(OauthGrant.count).to(eq(1))
    end

    it "keeps the existing responses rule: responses with publishing is still refused" do
      post("/api/me/oauth/authorization", params: params.merge(scope: "responses:read forms:publish", decision: "allow", granted_scopes: ["responses:read", "forms:publish"]), headers: auth_headers.merge(xhr), as: :json)
      expect(response).to(have_http_status(:unprocessable_entity))
    end
  end

  describe "the grant model" do
    let(:base) { { user: current_user, oauth_client: client, resource: "https://api.kurz.fyi/mcp" } }

    it "rejects personal data with publishing and accepts them apart" do
      expect(OauthGrant.new(base.merge(scopes: ["appointments:write", "pages:publish"]))).not_to(be_valid)
      expect(OauthGrant.new(base.merge(scopes: ["appointments:read", "forms:write"]))).to(be_valid)
    end
  end
end
