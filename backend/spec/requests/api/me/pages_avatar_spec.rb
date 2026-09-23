require "rails_helper"

RSpec.describe("/api/me/pages/:page_id/avatar", type: :request) do
  include_context "authenticated user"

  let(:page) { FactoryBot.create(:page, user: current_user) }

  before do
    host! "localhost"
  end

  def upload(path, content_type)
    Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files", path), content_type)
  end

  it "attaches a PNG and exposes the resized variant URL" do
    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers

    expect(response).to(have_http_status(:ok))
    expect(page.reload.avatar).to(be_attached)
    expect(page.avatar.blob.content_type).to(eq("image/png"))
    expect(JSON.parse(response.body)["page"]["avatar_url"]).to(include("/rails/active_storage/representations/proxy/"))
  end

  it "accepts an iPhone HEIC photo, whatever the client declares" do
    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.heic", "application/octet-stream") }, headers: auth_headers

    expect(response).to(have_http_status(:ok))
    expect(page.reload.avatar.blob.content_type).to(eq("image/heic"))
    expect(page.avatar.variant(:thumb)).to(be_a(ActiveStorage::VariantWithRecord))
  end

  it "converts a HEIC avatar to a 400x400 WebP" do
    skip("libvips without HEIF support") unless system("vips -l 2>/dev/null | grep -q heifload")

    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.heic", "image/heic") }, headers: auth_headers

    variant = page.reload.avatar.variant(:thumb).processed
    image = Vips::Image.new_from_buffer(variant.image.blob.download, "")
    expect(variant.image.blob.content_type).to(eq("image/webp"))
    expect([image.width, image.height]).to(eq([400, 400]))
  end

  it "rejects an SVG disguised as a PNG" do
    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("evil.png", "image/png") }, headers: auth_headers

    expect(response).to(have_http_status(:unprocessable_entity))
    expect(page.reload.avatar).not_to(be_attached)
    expect(ActiveStorage::Blob.count).to(eq(0))
  end

  it "rejects files over the size limit" do
    stub_const("Page::AVATAR_MAX_SIZE", 10)

    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers

    expect(response).to(have_http_status(:unprocessable_entity))
  end

  it "requires a file" do
    post "/api/me/pages/#{page.id}/avatar", params: {}, headers: auth_headers

    expect(response).to(have_http_status(:unprocessable_entity))
  end

  it "cannot change another user's avatar" do
    other = FactoryBot.create(:page)

    post "/api/me/pages/#{other.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers

    expect(response).to(have_http_status(:not_found))
    expect(other.reload.avatar).not_to(be_attached)
  end

  it "removes the avatar" do
    page.avatar.attach(io: File.open(Rails.root.join("spec/fixtures/files/avatar.png")), filename: "avatar", content_type: "image/png")

    delete "/api/me/pages/#{page.id}/avatar", headers: auth_headers

    expect(response).to(have_http_status(:no_content))
    expect(page.reload.avatar).not_to(be_attached)
  end
end
