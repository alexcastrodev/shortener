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

  def attach_avatar(record)
    record.avatar.attach(io: File.open(Rails.root.join("spec/fixtures/files/avatar.png")), filename: "avatar", content_type: "image/png")
  end

  it "stores the raw upload and queues it for optimization" do
    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers

    expect(response).to(have_http_status(:accepted))
    page.reload
    expect(page.avatar_upload).to(be_attached)
    expect(page.avatar).not_to(be_attached)
    expect(OptimizeAvatarJob).to(have_been_enqueued.with(page.id, page.avatar_upload.blob_id).on_queue("images"))
    expect(JSON.parse(response.body)["page"]).to(include("avatar_processing" => true, "avatar_url" => nil))
  end

  it "keeps showing the current avatar while the new one is processed" do
    attach_avatar(page)

    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers

    body = JSON.parse(response.body)["page"]
    expect(body["avatar_processing"]).to(be(true))
    expect(body["avatar_url"]).to(include("/rails/active_storage/representations/proxy/"))
  end

  it "shows the optimized avatar once the job ran" do
    perform_enqueued_jobs(only: OptimizeAvatarJob) do
      post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers
    end

    get "/api/me/pages/#{page.id}", headers: auth_headers

    body = JSON.parse(response.body)["page"]
    expect(body["avatar_processing"]).to(be(false))
    expect(body["avatar_url"]).to(include("/rails/active_storage/representations/proxy/"))
    expect(page.reload.avatar.blob.content_type).to(eq("image/webp"))
  end

  it "accepts an iPhone HEIC photo, whatever the client declares" do
    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.heic", "application/octet-stream") }, headers: auth_headers

    expect(response).to(have_http_status(:accepted))
    expect(page.reload.avatar_upload.blob.content_type).to(eq("image/heic"))
  end

  it "rejects an SVG disguised as a PNG" do
    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("evil.png", "image/png") }, headers: auth_headers

    expect(response).to(have_http_status(:unprocessable_entity))
    expect(page.reload.avatar_upload).not_to(be_attached)
    expect(ActiveStorage::Blob.count).to(eq(0))
    expect(OptimizeAvatarJob).not_to(have_been_enqueued)
  end

  # A decompression bomb as it arrives: a few dozen bytes whose PNG header
  # declares a 20000x20000 canvas. Only the header may ever be read.
  def png_declaring(width, height)
    chunk = lambda do |type, data|
      [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N")
    end
    "\x89PNG\r\n\x1A\n".b +
      chunk.call("IHDR", [width, height, 8, 2, 0, 0, 0].pack("NNCCCCC")) +
      chunk.call("IDAT", Zlib::Deflate.deflate("\x00".b)) +
      chunk.call("IEND", "")
  end

  it "rejects a small file declaring huge dimensions without storing it" do
    bomb = Rails.root.join("tmp/avatar-bomb-#{SecureRandom.hex(4)}.png")
    File.binwrite(bomb, png_declaring(20_000, 20_000))
    expect(File.size(bomb)).to(be < 100)

    post("/api/me/pages/#{page.id}/avatar", params: { avatar: Rack::Test::UploadedFile.new(bomb, "image/png") }, headers: auth_headers)

    expect(response).to(have_http_status(:unprocessable_entity))
    expect(JSON.parse(response.body)["errors"]["avatar"].first).to(include("megapixels"))
    expect(ActiveStorage::Blob.count).to(eq(0))
    expect(OptimizeAvatarJob).not_to(have_been_enqueued)
  ensure
    FileUtils.rm_f(bomb) if bomb
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

  it "rate limits uploads per user" do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?

    5.times do
      post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers
    end
    expect(response).to(have_http_status(:accepted))

    post "/api/me/pages/#{page.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers

    expect(response).to(have_http_status(:too_many_requests))
  end

  it "cannot change another user's avatar" do
    other = FactoryBot.create(:page)

    post "/api/me/pages/#{other.id}/avatar", params: { avatar: upload("avatar.png", "image/png") }, headers: auth_headers

    expect(response).to(have_http_status(:not_found))
    expect(other.reload.avatar_upload).not_to(be_attached)
  end

  it "removes the avatar and any upload still being processed" do
    attach_avatar(page)
    page.avatar_upload.attach(io: File.open(Rails.root.join("spec/fixtures/files/avatar.png")), filename: "avatar-upload", content_type: "image/png")

    delete "/api/me/pages/#{page.id}/avatar", headers: auth_headers

    expect(response).to(have_http_status(:no_content))
    page.reload
    expect(page.avatar).not_to(be_attached)
    expect(page.avatar_upload).not_to(be_attached)
  end
end
