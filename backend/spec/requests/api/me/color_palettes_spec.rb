require "rails_helper"

RSpec.describe("Color palettes and custom colors", type: :request) do
  include_context "authenticated user"

  let(:colors) { { background: "#112233", text: "#ffffff", accent: "#ff00aa" } }

  before do
    host! "localhost"
  end

  def json
    JSON.parse(response.body)
  end

  it "saves, lists and deletes the user's own palettes" do
    post "/api/me/color_palettes", params: { name: "Neon", custom_colors: colors }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:created))
    id = json["color_palette"]["id"]

    get "/api/me/color_palettes", headers: auth_headers
    expect(json["color_palette"].map { |palette| palette["name"] }).to(eq(["Neon"]))

    delete "/api/me/color_palettes/#{id}", headers: auth_headers
    expect(response).to(have_http_status(:no_content))
    expect(ColorPalette.count).to(eq(0))
  end

  it "never shows or deletes someone else's palette" do
    other = FactoryBot.create(:user)
    palette = ColorPalette.create!(user: other, name: "Theirs", custom_colors: colors.stringify_keys)

    get "/api/me/color_palettes", headers: auth_headers
    expect(json["color_palette"]).to(be_empty)

    delete "/api/me/color_palettes/#{palette.id}", headers: auth_headers
    expect(response).to(have_http_status(:not_found))
    expect(ColorPalette.exists?(palette.id)).to(be(true))
  end

  it "rejects colors that are not #RRGGBB and caps palettes per user" do
    post "/api/me/color_palettes", params: { name: "Bad", custom_colors: colors.merge(text: "red; background: url(x)") }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:unprocessable_entity))

    ColorPalette::MAX_PER_USER.times { |i| ColorPalette.create!(user: current_user, name: "P#{i}", custom_colors: colors.stringify_keys) }
    post "/api/me/color_palettes", params: { name: "One too many", custom_colors: colors }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:unprocessable_entity))
  end

  it "stores custom colors on a page and serves them publicly, validating the hex" do
    page = FactoryBot.create(:page, user: current_user, slug: "colorful")

    patch "/api/me/pages/#{page.id}", params: { custom_colors: colors }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:ok))

    get "/api/public/pages/colorful"
    expect(json["page"]["custom_colors"]).to(eq(colors.stringify_keys))

    patch "/api/me/pages/#{page.id}", params: { custom_colors: colors.merge(accent: "#fff") }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(page.reload.custom_colors["accent"]).to(eq("#ff00aa"))

    patch "/api/me/pages/#{page.id}", params: { custom_colors: nil }, headers: auth_headers, as: :json
    expect(page.reload.custom_colors).to(be_nil)
  end
end
