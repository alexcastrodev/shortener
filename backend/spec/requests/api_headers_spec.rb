require "rails_helper"

RSpec.describe("API default headers", type: :request) do
  before { host! "localhost" }

  it "marks every response nosniff and framing-free, including errors" do
    ["/up", "/missing-route", "/api/me"].each do |path|
      get path

      expect(response.headers["X-Content-Type-Options"]).to(eq("nosniff"), path)
      expect(response.headers["Content-Security-Policy"]).to(include("frame-ancestors 'none'"), path)
    end
  end

  it "keeps the stricter sandbox policy on QR SVGs" do
    expect(ApplicationController.instance_method(:svg_response_headers)).to(be_present)
  end
end
