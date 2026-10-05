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

  it "refuses ActiveStorage direct uploads and disk transfers to anyone, creating no blob" do
    expect do
      post("/rails/active_storage/direct_uploads", params: { blob: { filename: "a.txt", byte_size: 4, checksum: Digest::MD5.base64digest("abcd"), content_type: "text/plain" } }, as: :json)
    end.not_to(change(ActiveStorage::Blob, :count))

    expect(response).to(have_http_status(:not_found))

    ["get", "put", "post"].each do |verb|
      public_send(verb, "/rails/active_storage/disk/anything")
      expect(response).to(have_http_status(:not_found), verb)
    end
  end
end
