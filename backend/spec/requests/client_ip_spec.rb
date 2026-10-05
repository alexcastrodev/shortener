require "rails_helper"

RSpec.describe("Client IP resolution", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let!(:page) { Page.create!(user: user, slug: "ip-page", published: true) }
  let(:secret) { "s" * 32 }

  around do |example|
    ENV["SSR_FORWARD_SECRET"] = secret
    example.run
  ensure
    ENV.delete("SSR_FORWARD_SECRET")
  end

  before { host! "localhost" }

  def view(headers)
    get("/api/public/pages/ip-page", headers: headers)
    response.status
  end

  it "keeps one bucket per visitor when the front end forwards the address with the shared secret" do
    120.times { |i| view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.#{i % 250 + 1}", "X-Ssr-Secret" => secret) }

    expect(view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.200", "X-Ssr-Secret" => secret)).to(eq(200))
    expect(view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.77", "X-Ssr-Secret" => secret)).to(eq(200))
  end

  it "still limits one forwarded visitor to 120 views a minute" do
    121.times { view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.9", "X-Ssr-Secret" => secret) }

    expect(view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.9", "X-Ssr-Secret" => secret)).to(eq(429))
    expect(view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.10", "X-Ssr-Secret" => secret)).to(eq(200))
  end

  it "ignores the forwarded address without the secret, with a wrong one, or when the feature is off" do
    121.times { view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.1") }
    expect(view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.2")).to(eq(429))
    expect(view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.3", "X-Ssr-Secret" => "wrong")).to(eq(429))

    ENV.delete("SSR_FORWARD_SECRET")
    expect(view("CF-Connecting-IP" => "203.0.113.1", "X-Visitor-Ip" => "198.51.100.4", "X-Ssr-Secret" => "")).to(eq(429))
  end

  it "ignores a malformed forwarded address and falls back to the Cloudflare one" do
    121.times { view("CF-Connecting-IP" => "203.0.113.9", "X-Visitor-Ip" => "not-an-ip/../x", "X-Ssr-Secret" => secret) }

    expect(view("CF-Connecting-IP" => "203.0.113.9", "X-Visitor-Ip" => "also bad", "X-Ssr-Secret" => secret)).to(eq(429))
  end
end
