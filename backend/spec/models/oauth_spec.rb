require "rails_helper"

RSpec.describe("OAuth models") do
  let(:user) { FactoryBot.create(:user) }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
  let(:grant) { OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp") }

  describe OauthClient do
    it "gets a random client_id and validates its redirect URIs" do
      expect(client.client_id.length).to(be >= 24)
      expect(OauthClient.new(client_name: "x", redirect_uris: ["https://evil.example/cb"])).not_to(be_valid)
      expect(OauthClient.new(client_name: "x", redirect_uris: [])).not_to(be_valid)
      expect(OauthClient.new(client_name: "x", redirect_uris: ["https://claude.ai/cb"] * 6)).not_to(be_valid)
      expect(OauthClient.new(client_name: "", redirect_uris: ["https://claude.ai/cb"])).not_to(be_valid)
      expect(OauthClient.new(client_name: "n" * 101, redirect_uris: ["https://claude.ai/cb"])).not_to(be_valid)
    end

    it "matches only a registered redirect URI" do
      expect(client.redirect_uri?("https://claude.ai/api/mcp/auth_callback")).to(be(true))
      expect(client.redirect_uri?("https://claude.ai/api/mcp/auth_callback/")).to(be(false))
    end
  end

  describe OauthGrant do
    it "only accepts known scopes, without repeats" do
      [["nope"], [], ["forms:read", "forms:read"], "forms:read"].each do |scopes|
        expect(OauthGrant.new(user: user, oauth_client: client, scopes: scopes, resource: "r")).not_to(be_valid)
      end
    end

    it "revokes itself and every token, and audits only scopes and revoked_at" do
      OauthAccessToken.issue(grant)
      OauthRefreshToken.issue(grant)

      grant.revoke!

      expect(grant).not_to(be_active)
      expect(grant.access_tokens.count + grant.refresh_tokens.count).to(eq(0))
      expect(grant.audits.flat_map { |a| a.audited_changes.keys }.uniq).to(match_array(["scopes", "revoked_at"]))
    end

    it "is removed with its user" do
      grant
      expect { user.destroy! }.to(change(OauthGrant, :count).by(-1))
    end
  end

  describe "tokens" do
    it "stores only digests and prefixes each kind" do
      raw, ttl = OauthAccessToken.issue(grant)

      expect(raw).to(start_with("kz_at_"))
      expect(ttl).to(eq(3600))
      expect(OauthAccessToken.pluck(:token_digest)).to(eq([Oauth::Tokens.digest(raw)]))
      expect(OauthAccessToken.column_names.join).not_to(include("raw"))
      expect(OauthRefreshToken.issue(grant)).to(start_with("kz_rt_"))
      expect(OauthAuthorizationCode.issue(grant: grant, code_challenge: "c", redirect_uri: "r")).to(start_with("kz_ac_"))
    end

    it "authenticates a valid access token and refuses wrong kinds, expired and unknown ones" do
      raw, = OauthAccessToken.issue(grant)

      expect(OauthAccessToken.authenticate(raw).oauth_grant).to(eq(grant))
      ["", nil, "kz_at_nope", raw.sub("kz_at_", "kz_rt_"), "x" * 500, ["a"]].each do |bad|
        expect(OauthAccessToken.authenticate(bad)).to(be_nil)
      end
      travel_to(2.hours.from_now) { expect(OauthAccessToken.authenticate(raw)).to(be_nil) }
    end

    it "caps refresh tokens at 30 days sliding and 90 days absolute" do
      raw = OauthRefreshToken.issue(grant)
      token = OauthRefreshToken.find_by(token_digest: Oauth::Tokens.digest(raw))

      expect(token.expires_at).to(be_within(5.seconds).of(30.days.from_now))
      near_end = OauthRefreshToken.issue(grant, absolute_expires_at: 10.days.from_now)
      expect(OauthRefreshToken.find_by(token_digest: Oauth::Tokens.digest(near_end)).expires_at).to(be_within(5.seconds).of(10.days.from_now))
    end
  end

  describe OauthAuthorizationCode do
    it "redeems once and expires after 60 seconds" do
      raw = described_class.issue(grant: grant, code_challenge: "c", redirect_uri: "r")

      expect(described_class.redeem(raw).oauth_grant).to(eq(grant))
      expect(described_class.redeem(raw)).to(be_nil)

      other = described_class.issue(grant: OauthGrant.create!(user: user, oauth_client: client, scopes: ["forms:read"], resource: "r"), code_challenge: "c", redirect_uri: "r")
      travel_to(2.minutes.from_now) { expect(described_class.redeem(other)).to(be_nil) }
    end

    it "revokes the grant when a used code is replayed" do
      raw = described_class.issue(grant: grant, code_challenge: "c", redirect_uri: "r")
      OauthAccessToken.issue(grant)
      described_class.redeem(raw)

      described_class.redeem(raw)

      expect(grant.reload).not_to(be_active)
      expect(grant.access_tokens.count).to(eq(0))
    end

    it "gives exactly one winner when two redeem at once" do
      raw = described_class.issue(grant: grant, code_challenge: "c", redirect_uri: "r")
      allow_any_instance_of(ActiveRecord::Relation).to(receive(:update_all).and_wrap_original do |original, *args|
        sleep(0.15)
        original.call(*args)
      end)

      results = Array.new(2) { Thread.new { ActiveRecord::Base.connection_pool.with_connection { described_class.redeem(raw) } } }.map(&:value)

      expect(results.compact.size).to(eq(1))
    end

    it "ignores values that are not codes" do
      expect(described_class.redeem(nil)).to(be_nil)
      expect(described_class.redeem("kz_at_wrong")).to(be_nil)
      expect(described_class.redeem("x" * 500)).to(be_nil)
    end
  end

  describe OauthRefreshToken do
    it "rotates once; reusing the old token revokes the grant and every token" do
      first = described_class.issue(grant)
      OauthAccessToken.issue(grant)

      expect(described_class.rotate(first)).to(be_present)
      fresh = described_class.issue(grant)
      expect(described_class.rotate(first)).to(be_nil)

      expect(grant.reload).not_to(be_active)
      expect(described_class.rotate(fresh)).to(be_nil)
      expect(grant.access_tokens.count).to(eq(0))
    end

    it "refuses an expired refresh token" do
      raw = described_class.issue(grant)

      travel_to(31.days.from_now) { expect(described_class.rotate(raw)).to(be_nil) }
    end

    it "gives exactly one winner for two simultaneous refreshes" do
      raw = described_class.issue(grant)
      allow_any_instance_of(ActiveRecord::Relation).to(receive(:update_all).and_wrap_original do |original, *args|
        sleep(0.15)
        original.call(*args)
      end)

      results = Array.new(2) { Thread.new { ActiveRecord::Base.connection_pool.with_connection { described_class.rotate(raw) } } }.map(&:value)

      expect(results.compact.size).to(eq(1))
    end
  end
end
