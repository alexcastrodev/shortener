require "rails_helper"

RSpec.describe("PATCH /api/me time zone", type: :request) do
  include_context "authenticated user"

  let(:json) { JSON.parse(response.body) }

  before { host! "localhost" }

  def patch_me(params)
    patch("/api/me", params: params, headers: auth_headers, as: :json)
  end

  it "defaults to UTC" do
    get("/api/me", headers: auth_headers)
    expect(json.dig("user", "time_zone")).to(eq("UTC"))
  end

  it "saves a valid IANA zone and returns it" do
    patch_me(time_zone: "Europe/Lisbon")
    expect(response).to(have_http_status(:ok))
    expect(json.dig("user", "time_zone")).to(eq("Europe/Lisbon"))
    expect(current_user.reload.time_zone).to(eq("Europe/Lisbon"))
  end

  it "rejects a zone that does not exist and keeps the previous one" do
    patch_me(time_zone: "Mars/Olympus")
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(json["error"]).to(eq("invalid_time_zone"))
    expect(current_user.reload.time_zone).to(eq("UTC"))
  end

  it "rejects a blank zone" do
    patch_me(time_zone: "")
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(current_user.reload.time_zone).to(eq("UTC"))
  end

  it "ignores attributes other than the time zone" do
    patch_me(time_zone: "America/Sao_Paulo", admin: true, email: "x@example.com")
    expect(response).to(have_http_status(:ok))
    current_user.reload
    expect(current_user.admin).to(be(false))
    expect(current_user.email).not_to(eq("x@example.com"))
  end

  it "answers 401 without a token" do
    patch("/api/me", params: { time_zone: "Europe/Lisbon" }, as: :json)
    expect(response).to(have_http_status(:unauthorized))
  end
end
