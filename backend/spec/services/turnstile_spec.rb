require "rails_helper"

RSpec.describe(Turnstile) do
  let(:verify_url) { "https://challenges.cloudflare.com/turnstile/v0/siteverify" }

  around do |example|
    ENV["TURNSTILE_SECRET_KEY"] = "secret"
    ENV["TURNSTILE_HOSTNAMES"] = "kurz.fyi"
    example.run
  ensure
    ENV.delete("TURNSTILE_SECRET_KEY")
    ENV.delete("TURNSTILE_HOSTNAMES")
  end

  def cloudflare_says(body)
    stub_request(:post, verify_url).to_return(status: 200, body: body.to_json, headers: { "Content-Type" => "application/json" })
  end

  it "accepts a token Cloudflare confirmed for this action and hostname" do
    cloudflare_says(success: true, action: "login", hostname: "kurz.fyi")

    expect(described_class.valid?("token", action: "login", remote_ip: "1.2.3.4")).to(be(true))
    expect(a_request(:post, verify_url).with(body: hash_including("secret" => "secret", "response" => "token", "remoteip" => "1.2.3.4"))).to(have_been_made)
  end

  it "rejects failures, other actions and other hostnames" do
    cloudflare_says(success: false, "error-codes": ["timeout-or-duplicate"])
    expect(described_class.valid?("token", action: "login", remote_ip: "1.2.3.4")).to(be(false))

    cloudflare_says(success: true, action: "signup", hostname: "kurz.fyi")
    expect(described_class.valid?("token", action: "login", remote_ip: "1.2.3.4")).to(be(false))

    cloudflare_says(success: true, action: "login", hostname: "evil.example")
    expect(described_class.valid?("token", action: "login", remote_ip: "1.2.3.4")).to(be(false))
  end

  it "rejects a missing token without calling Cloudflare" do
    expect(described_class.valid?("", action: "login", remote_ip: "1.2.3.4")).to(be(false))
    expect(a_request(:post, verify_url)).not_to(have_been_made)
  end

  it "lets requests through when Cloudflare cannot be reached" do
    stub_request(:post, verify_url).to_timeout

    expect(described_class.valid?("token", action: "login", remote_ip: "1.2.3.4")).to(be(true))
  end

  it "accepts Cloudflare's test keys outside production only" do
    cloudflare_says(success: true, hostname: "example.com", metadata: { result_with_testing_key: true })
    expect(described_class.valid?("XXXX.DUMMY.TOKEN.XXXX", action: "login", remote_ip: "1.2.3.4")).to(be(true))

    allow(Rails.env).to(receive(:production?).and_return(true))
    expect(described_class.valid?("XXXX.DUMMY.TOKEN.XXXX", action: "login", remote_ip: "1.2.3.4")).to(be(false))
  end

  it "is off without a secret key" do
    ENV.delete("TURNSTILE_SECRET_KEY")

    expect(described_class.valid?(nil, action: "login", remote_ip: "1.2.3.4")).to(be(true))
  end
end
