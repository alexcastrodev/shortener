require "rails_helper"

RSpec.describe("Shortlink password and expiration", type: :request) do
  include_context "authenticated user"

  let(:shortlink) { current_user.shortlinks.create!(original_url: "https://example.com") }

  before do
    host! "localhost"
  end

  def cached(link)
    raw = Rails.cache.redis.with { |conn| conn.get(link.cache_key) }
    raw && JSON.parse(raw)
  end

  it "creates a password-protected link without exposing the digest" do
    post "/api/me/shortlinks", params: { original_url: "https://example.com", password: "hunter22" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:created))
    body = JSON.parse(response.body)["shortlink"]
    expect(body["password_protected"]).to(be(true))
    expect(body.keys.grep(/password_digest|password$/)).to(be_empty)
    expect(Shortlink.last.authenticate("hunter22")).to(be_truthy)
  end

  it "rejects passwords that are too short" do
    post "/api/me/shortlinks", params: { original_url: "https://example.com", password: "abc" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:unprocessable_entity))
  end

  it "locks and unlocks an existing link, refreshing the edge cache" do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?

    patch "/api/me/shortlinks/#{shortlink.id}", params: { password: "hunter22" }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:ok))
    expect(cached(shortlink)).to(eq({ "t" => "locked" }))

    patch "/api/me/shortlinks/#{shortlink.id}", params: { password: "" }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:ok))
    expect(shortlink.reload.password_digest).to(be_nil)
    expect(cached(shortlink)).to(eq({ "t" => "url", "v" => "https://example.com" }))
  end

  it "keeps the password when the update does not mention it" do
    shortlink.update!(password: "hunter22")

    patch "/api/me/shortlinks/#{shortlink.id}", params: { title: "New title" }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:ok))
    expect(shortlink.reload.authenticate("hunter22")).to(be_truthy)
  end

  it "sets an expiration date in the future" do
    expires_at = 2.days.from_now.change(usec: 0)

    patch "/api/me/shortlinks/#{shortlink.id}", params: { expires_at: expires_at.iso8601 }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:ok))
    expect(shortlink.reload.expires_at).to(eq(expires_at))
    expect(JSON.parse(response.body)["shortlink"]["expires_at"]).to(eq(expires_at.iso8601))
  end

  it "rejects an expiration date in the past" do
    patch "/api/me/shortlinks/#{shortlink.id}", params: { expires_at: 1.hour.ago.iso8601 }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:unprocessable_entity))
  end

  it "removes an expiration date" do
    shortlink.update!(expires_at: 2.days.from_now)

    patch "/api/me/shortlinks/#{shortlink.id}", params: { expires_at: nil }, headers: auth_headers, as: :json

    expect(response).to(have_http_status(:ok))
    expect(shortlink.reload.expires_at).to(be_nil)
  end
end
