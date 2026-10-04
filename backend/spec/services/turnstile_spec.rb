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

  describe ".check" do
    def check(token = "token", action: "form_response")
      described_class.check(token, action: action, remote_ip: "1.2.3.4")
    end

    it "answers :ok only for a token Cloudflare confirmed for this action and hostname" do
      cloudflare_says(success: true, action: "form_response", hostname: "kurz.fyi")

      expect(check).to(eq(:ok))
    end

    it "answers :rejected for failures, replays, other actions and other hostnames" do
      cloudflare_says(success: false, "error-codes": ["timeout-or-duplicate"])
      expect(check).to(eq(:rejected))

      cloudflare_says(success: true, action: "login", hostname: "kurz.fyi")
      expect(check).to(eq(:rejected))

      cloudflare_says(success: true, action: "form_response", hostname: "evil.example")
      expect(check).to(eq(:rejected))
    end

    it "answers :rejected for a missing or malformed token without calling Cloudflare" do
      [nil, "", ["a"], { "a" => 1 }, 5].each do |bad|
        expect(check(bad)).to(eq(:rejected))
      end
      expect(a_request(:post, verify_url)).not_to(have_been_made)
    end

    {
      "a timeout" => -> { stub_request(:post, verify_url).to_timeout },
      "a refused connection" => -> { stub_request(:post, verify_url).to_raise(Errno::ECONNREFUSED) },
      "a reset connection" => -> { stub_request(:post, verify_url).to_raise(Errno::ECONNRESET) },
      "an unreachable host" => -> { stub_request(:post, verify_url).to_raise(Errno::EHOSTUNREACH) },
      "an invalid TLS certificate" => -> { stub_request(:post, verify_url).to_raise(OpenSSL::SSL::SSLError) },
      "a dropped socket" => -> { stub_request(:post, verify_url).to_raise(EOFError) },
      "a 500 with HTML" => -> { stub_request(:post, verify_url).to_return(status: 500, body: "<html>oops</html>") },
      "an empty array" => -> { stub_request(:post, verify_url).to_return(status: 200, body: "[]") },
      "null" => -> { stub_request(:post, verify_url).to_return(status: 200, body: "null") },
      "an empty object" => -> { stub_request(:post, verify_url).to_return(status: 200, body: "{}") },
    }.each do |name, stub|
      it "answers :unavailable, never raises, for #{name}" do
        instance_exec(&stub)

        expect(check).to(eq(:unavailable))
        expect(described_class.valid?("token", action: "form_response", remote_ip: "1.2.3.4")).to(be(true))
      end
    end

    it "answers :unavailable without a secret key" do
      ENV.delete("TURNSTILE_SECRET_KEY")

      expect(check).to(eq(:unavailable))
      expect(a_request(:post, verify_url)).not_to(have_been_made)
    end

    it "raises an alert to Sentry when Cloudflare is unavailable" do
      allow(Sentry).to(receive(:initialized?).and_return(true))
      expect(Sentry).to(receive(:capture_message).with(/Turnstile unavailable/, level: :warning))
      stub_request(:post, verify_url).to_timeout

      check
    end
  end
end
