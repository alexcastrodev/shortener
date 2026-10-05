require "rails_helper"

RSpec.describe("PATCH /api/me locale", type: :request) do
  include_context "authenticated user"

  let(:json) { JSON.parse(response.body) }

  before { host! "localhost" }

  def patch_me(params)
    patch("/api/me", params: params, headers: auth_headers, as: :json)
  end

  it "starts without a preference" do
    get("/api/me", headers: auth_headers)
    expect(json.dig("user", "locale")).to(be_nil)
  end

  it "saves a supported language and returns it" do
    patch_me(locale: "pt-PT")
    expect(response).to(have_http_status(:ok))
    expect(json.dig("user", "locale")).to(eq("pt-PT"))
    expect(current_user.reload.locale).to(eq("pt-PT"))
  end

  it "clears the preference with a blank value" do
    current_user.update!(locale: "pt-PT")
    patch_me(locale: "")
    expect(response).to(have_http_status(:ok))
    expect(current_user.reload.locale).to(be_nil)
  end

  it "rejects a language that is not supported and keeps the previous one" do
    current_user.update!(locale: "en")
    patch_me(locale: "xx")
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(json["error"]).to(eq("invalid_locale"))
    expect(current_user.reload.locale).to(eq("en"))
  end

  it "keeps the time zone error code for a bad time zone" do
    patch_me(time_zone: "Mars/Olympus")
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(json["error"]).to(eq("invalid_time_zone"))
  end

  it "saves the language and the time zone together" do
    patch_me(locale: "pt-PT", time_zone: "Europe/Lisbon")
    expect(response).to(have_http_status(:ok))
    current_user.reload
    expect([current_user.locale, current_user.time_zone]).to(eq(["pt-PT", "Europe/Lisbon"]))
  end
end
