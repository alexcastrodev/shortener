require "rails_helper"

RSpec.describe("/api/public/shortlinks/:short_code", type: :request) do
  let(:shortlink) { FactoryBot.create(:shortlink, original_url: "https://secret.example.com", password: "hunter22") }
  let(:headers) { { "CF-Connecting-IP" => "203.0.113.#{rand(1..254)}", "User-Agent" => "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0" } }

  before do
    host! "localhost"
  end

  describe "GET" do
    it "tells the form the link exists and is locked, without the destination" do
      get "/api/public/shortlinks/#{shortlink.short_code}"

      expect(response).to(have_http_status(:ok))
      expect(JSON.parse(response.body)).to(eq({ "short_code" => shortlink.short_code, "locked" => true }))
    end

    it "is not found for links without a password" do
      open_link = FactoryBot.create(:shortlink)

      get "/api/public/shortlinks/#{open_link.short_code}"

      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "POST unlock" do
    it "returns the destination and records the click for the right password" do
      expect do
        post "/api/public/shortlinks/#{shortlink.short_code}/unlock", params: { password: "hunter22" }, headers: headers, as: :json
      end.to(change { shortlink.events.count }.by(1))

      expect(response).to(have_http_status(:ok))
      expect(JSON.parse(response.body)).to(eq({ "original_url" => "https://secret.example.com" }))
      expect(shortlink.events.last).to(have_attributes(ip_address: headers["CF-Connecting-IP"], browser: "Chrome", platform: "Windows"))
    end

    it "rejects a wrong password without revealing the destination" do
      post "/api/public/shortlinks/#{shortlink.short_code}/unlock", params: { password: "nope" }, headers: headers, as: :json

      expect(response).to(have_http_status(:unauthorized))
      expect(response.body).not_to(include("secret.example.com"))
      expect(shortlink.events.count).to(eq(0))
    end

    it "does not unlock inactive, unsafe or expired links" do
      shortlink.update_columns(expires_at: 1.minute.ago)

      post "/api/public/shortlinks/#{shortlink.short_code}/unlock", params: { password: "hunter22" }, headers: headers, as: :json

      expect(response).to(have_http_status(:not_found))
    end

    it "rate limits guesses per link and IP, ignoring a spoofed X-Forwarded-For" do
      skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?

      10.times do |i|
        post "/api/public/shortlinks/#{shortlink.short_code}/unlock",
          params: { password: "guess#{i}" },
          headers: headers.merge("X-Forwarded-For" => "198.51.100.#{i}"),
          as: :json
      end
      expect(response).to(have_http_status(:unauthorized))

      post "/api/public/shortlinks/#{shortlink.short_code}/unlock", params: { password: "hunter22" }, headers: headers, as: :json

      expect(response).to(have_http_status(:too_many_requests))
    end
  end
end
