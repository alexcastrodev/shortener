require "rails_helper"

RSpec.describe(TrafficSource) do
  def source(user_agent: "Mozilla/5.0 (iPhone) Safari/604.1", referer: nil)
    described_class.call(user_agent: user_agent, referer: referer)
  end

  it "recognises in-app browsers, which send no referer" do
    expect(source(user_agent: "Mozilla/5.0 (iPhone) Instagram 312.0")).to(eq("Instagram"))
    expect(source(user_agent: "Mozilla/5.0 (Linux; Android 14) musical_ly_2023")).to(eq("TikTok"))
    expect(source(user_agent: "Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0]")).to(eq("Facebook"))
  end

  it "falls back to the referer's host, subdomains included" do
    expect(source(referer: "https://l.instagram.com/?u=x")).to(eq("Instagram"))
    expect(source(referer: "https://t.co/abc")).to(eq("X"))
    expect(source(referer: "https://www.google.com.br/")).to(eq("Google"))
    expect(source(referer: "https://kurz.fyi/abc")).to(eq("Kurz"))
    expect(source(referer: "https://someblog.dev/post")).to(eq("Other"))
  end

  it "does not match look-alike hosts" do
    expect(source(referer: "https://notinstagram.com/")).to(eq("Other"))
  end

  it "treats a missing or broken referer as direct" do
    expect(source(referer: nil)).to(eq("Direct"))
    expect(source(referer: "")).to(eq("Direct"))
    expect(source(referer: "http://[bad")).to(eq("Direct"))
  end
end
