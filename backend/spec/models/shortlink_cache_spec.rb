require "rails_helper"

# The value under shortlink:<code> is the contract with the edge function
# (edge-function/cache.ts). Needs a real Redis (REDIS_URL, as in CI).
RSpec.describe(Shortlink, "redirect cache") do
  before { skip("requires REDIS_URL") if ENV["REDIS_URL"].blank? }

  def cached(shortlink)
    raw = Rails.cache.redis.with { |conn| conn.get(shortlink.cache_key) }
    raw && JSON.parse(raw)
  end

  it "stores links without a password exactly as a url entry" do
    shortlink = FactoryBot.create(:shortlink, original_url: "https://example.com/a?b=1")

    expect(cached(shortlink)).to(eq({ "t" => "url", "v" => "https://example.com/a?b=1" }))
  end

  it "never stores the destination of a password-protected link" do
    shortlink = FactoryBot.create(:shortlink, original_url: "https://secret.example.com", password: "hunter22")

    expect(cached(shortlink)).to(eq({ "t" => "locked" }))
  end

  it "removes the entry when the link expires" do
    shortlink = FactoryBot.create(:shortlink)
    shortlink.update_columns(expires_at: 1.minute.ago)

    shortlink.expire!

    expect(cached(shortlink)).to(be_nil)
    expect(shortlink.reload.inactive_at).to(be_present)
  end

  it "does not reactivate an expired link when it is marked safe" do
    shortlink = FactoryBot.create(:shortlink)
    shortlink.update_columns(expires_at: 1.minute.ago)
    shortlink.expire!

    shortlink.mark_as_safe!

    expect(shortlink.reload.inactive_at).to(be_present)
    expect(cached(shortlink)).to(be_nil)
  end
end
