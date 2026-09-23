require "rails_helper"

RSpec.describe("QR codes", type: :request) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  it "renders the shortlink's short URL as SVG" do
    shortlink = FactoryBot.create(:shortlink, user: current_user)
    allow(QrCodeService).to(receive(:svg).and_call_original)

    get "/api/me/shortlinks/#{shortlink.id}/qr_code", headers: auth_headers

    expect(response).to(have_http_status(:ok))
    expect(response.media_type).to(eq("image/svg+xml"))
    expect(response.body).to(start_with("<?xml").and(include("<svg")))
    expect(QrCodeService).to(have_received(:svg).with(shortlink.short_url))
  end

  it "renders the page's public URL as SVG" do
    page = FactoryBot.create(:page, user: current_user)
    allow(QrCodeService).to(receive(:svg).and_call_original)

    get "/api/me/pages/#{page.id}/qr_code", headers: auth_headers

    expect(response).to(have_http_status(:ok))
    expect(response.media_type).to(eq("image/svg+xml"))
    expect(QrCodeService).to(have_received(:svg).with(page.public_url))
  end

  it "does not render QR codes for other users' shortlinks" do
    shortlink = FactoryBot.create(:shortlink)

    get "/api/me/shortlinks/#{shortlink.id}/qr_code", headers: auth_headers

    expect(response).to(have_http_status(:not_found))
  end
end
