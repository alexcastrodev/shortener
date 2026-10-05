require "rails_helper"

RSpec.describe(Oauth::RedirectUri) do
  def match?(registered, requested)
    described_class.match?(registered, requested)
  end

  let(:registered) { "https://claude.ai/api/mcp/auth_callback" }

  it "accepts exactly the registered URI" do
    expect(match?(registered, registered)).to(be(true))
  end

  [
    "https://claude.ai/api/mcp/auth_callback/",
    "https://CLAUDE.AI/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback?x=1",
    "https://claude.ai/api/mcp/auth_callback#frag",
    "https://claude.ai/api/mcp/../mcp/auth_callback",
    "https://claude.ai//api/mcp/auth_callback",
    "//evil.example/api/mcp/auth_callback",
    "https://good@evil.example/api/mcp/auth_callback",
    "https://claude.ai@evil.example/api/mcp/auth_callback",
    "https://claude.ai\\@evil.example/",
    "https://claude.ai:444/api/mcp/auth_callback",
    "http://claude.ai/api/mcp/auth_callback",
    "javascript:alert(1)",
    "data:text/html,x",
    "https://claude.ai/api/mcp/%61uth_callback",
    "https://xn--claude-xyz.ai/api/mcp/auth_callback",
    " https://claude.ai/api/mcp/auth_callback",
    "https://claude.ai/api/mcp/auth_callback\r\nX: y",
    "https://claude.ai/api/mcp/auth_callback\u0000",
    "",
    nil,
    ["https://claude.ai/api/mcp/auth_callback"],
  ].each do |requested|
    it "rejects #{requested.inspect[0, 60]}" do
      expect(match?(registered, requested)).to(be(false))
    end
  end

  it "only registers hosts from MCP_REDIRECT_HOSTS (default claude.ai, claude.com, chatgpt.com)" do
    expect(described_class.valid?("https://chatgpt.com/connector/oauth/abc")).to(be(true))
    expect(described_class.valid?("https://evil.example/cb")).to(be(false))
    expect(described_class.valid?("https://sub.claude.ai/cb")).to(be(false))

    original = ENV["MCP_REDIRECT_HOSTS"]
    ENV["MCP_REDIRECT_HOSTS"] = "app.example"
    expect(described_class.valid?("https://app.example/cb")).to(be(true))
    expect(described_class.valid?("https://claude.ai/cb")).to(be(false))
  ensure
    original ? ENV["MCP_REDIRECT_HOSTS"] = original : ENV.delete("MCP_REDIRECT_HOSTS")
  end

  describe "loopback" do
    it "ignores only the port, and only over http" do
      expect(match?("http://127.0.0.1:3000/cb", "http://127.0.0.1:54321/cb")).to(be(true))
      expect(match?("http://localhost/cb", "http://localhost:8080/cb")).to(be(true))
      expect(match?("http://[::1]:1/cb", "http://[::1]:2/cb")).to(be(true))
    end

    it "still compares host, path and query" do
      expect(match?("http://127.0.0.1:3000/cb", "http://localhost:3000/cb")).to(be(false))
      expect(match?("http://127.0.0.1:3000/cb", "http://127.0.0.1:3000/other")).to(be(false))
      expect(match?("http://127.0.0.1:3000/cb", "http://127.0.0.1:3000/cb?x=1")).to(be(false))
      expect(match?("http://127.0.0.1:3000/cb", "https://127.0.0.1:3000/cb")).to(be(false))
    end

    it "does not accept a look-alike host" do
      expect(match?("http://127.0.0.1/cb", "http://127.0.0.1.evil.example/cb")).to(be(false))
      expect(described_class.valid?("http://evil.example/cb")).to(be(false))
    end
  end
end
