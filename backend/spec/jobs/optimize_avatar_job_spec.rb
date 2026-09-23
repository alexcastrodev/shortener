require "rails_helper"

RSpec.describe(OptimizeAvatarJob, type: :job) do
  let(:page) { FactoryBot.create(:page) }

  def attach_upload(io, content_type)
    page.avatar_upload.attach(io: io, filename: "avatar-upload", content_type: content_type, metadata: { analyzed: true })
    page.avatar_upload.blob_id
  end

  def image_upload(width, height)
    buffer = Vips::Image.black(width, height, bands: 3).jpegsave_buffer
    attach_upload(StringIO.new(buffer), "image/jpeg")
  end

  def dimensions(blob)
    image = Vips::Image.new_from_buffer(blob.download, "")
    [image.width, image.height]
  end

  it "replaces the avatar with a WebP of at most AVATAR_MAX_EDGE and drops the upload" do
    blob_id = image_upload(3000, 2000)

    described_class.perform_now(page.id, blob_id)

    page.reload
    expect(page.avatar.blob.content_type).to(eq("image/webp"))
    expect(dimensions(page.avatar.blob)).to(eq([1024, 683]))
    expect(page.avatar_upload).not_to(be_attached)
    expect(page.avatar_processing?).to(be(false))
  end

  it "does not upscale small images" do
    blob_id = image_upload(300, 200)

    described_class.perform_now(page.id, blob_id)

    expect(dimensions(page.reload.avatar.blob)).to(eq([300, 200]))
  end

  it "renders the thumb up front so no visitor pays for it" do
    blob_id = image_upload(800, 800)

    described_class.perform_now(page.id, blob_id)

    expect(page.reload.avatar.variant(:thumb).send(:processed?)).to(be(true))
  end

  it "converts a HEIC photo" do
    skip("libvips without HEIF support") unless system("vips -l 2>/dev/null | grep -q heifload")
    blob_id = attach_upload(File.open(Rails.root.join("spec/fixtures/files/avatar.heic")), "image/heic")

    described_class.perform_now(page.id, blob_id)

    expect(page.reload.avatar.blob.content_type).to(eq("image/webp"))
  end

  it "does nothing when a newer upload replaced this one" do
    stale_id = image_upload(100, 100)
    image_upload(200, 200)

    described_class.perform_now(page.id, stale_id)

    page.reload
    expect(page.avatar).not_to(be_attached)
    expect(page.avatar_upload).to(be_attached)
  end

  it "does nothing when the avatar was removed meanwhile" do
    blob_id = image_upload(100, 100)
    page.avatar_upload.purge

    expect { described_class.perform_now(page.id, blob_id) }.not_to(raise_error)
    expect(page.reload.avatar).not_to(be_attached)
  end

  it "drops an undecodable upload and keeps the previous avatar" do
    page.avatar.attach(io: File.open(Rails.root.join("spec/fixtures/files/avatar.png")), filename: "avatar", content_type: "image/png")
    previous_blob_id = page.avatar.blob_id
    truncated = Vips::Image.black(500, 500, bands: 3).jpegsave_buffer.byteslice(0, 400)
    blob_id = attach_upload(StringIO.new(truncated), "image/jpeg")

    described_class.perform_now(page.id, blob_id)

    page.reload
    expect(page.avatar_upload).not_to(be_attached)
    expect(page.avatar.blob_id).to(eq(previous_blob_id))
  end
end
