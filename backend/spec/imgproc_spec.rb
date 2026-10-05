require "rails_helper"
require Rails.root.join("imgproc/app")
require "rack/mock_request"

RSpec.describe(ImgprocApp) do
  let(:app) { described_class.new }
  let(:request) { Rack::MockRequest.new(app) }

  def png(width = 20, height = 10)
    Vips::Image.black(width, height).bandjoin([0, 0]).copy(interpretation: :srgb).write_to_buffer(".png")
  end

  def post(body)
    request.post("/convert", input: body, "CONTENT_LENGTH" => body.bytesize.to_s)
  end

  it "answers a health check" do
    expect(request.get("/up").status).to(eq(200))
  end

  it "converts PNG, JPEG and WebP to WebP" do
    image = Vips::Image.black(20, 10).bandjoin([0, 0]).copy(interpretation: :srgb)
    [".png", ".jpg", ".webp"].each do |suffix|
      response = post(image.write_to_buffer(suffix))

      expect(response.status).to(eq(200), suffix)
      expect(response.body.b).to(start_with("RIFF".b))
      expect(response.body.b[8, 4]).to(eq("WEBP".b))
    end
  end

  it "converts the HEIC fixture when libheif is available" do
    skip "libheif missing" unless Vips.get_suffixes.include?(".heic")

    response = post(File.binread(Rails.root.join("spec/fixtures/files/avatar.heic")))

    expect(response.status).to(eq(200))
    expect(response.body.b[8, 4]).to(eq("WEBP".b))
  end

  it "strips EXIF and limits the longest side" do
    big = Vips::Image.black(6000, 100).bandjoin([0, 0]).copy(interpretation: :srgb)
    jpeg = big.write_to_buffer(".jpg", Q: 80)
    tiff = "II*\x00\x08\x00\x00\x00".b + [1].pack("v") + [0x010F, 2, 13, 26].pack("vvVV") + [0].pack("V") + "SecretCamera\x00".b
    input = jpeg.byteslice(0, 2) + "\xFF\xE1".b + [8 + tiff.bytesize].pack("n") + "Exif\x00\x00".b + tiff + jpeg.byteslice(2..)
    expect(Vips::Image.new_from_buffer(input, "").get_fields).to(include("exif-data"))

    output = post(input).body
    out = Vips::Image.new_from_buffer(output, "")

    expect(out.width).to(eq(ImgprocApp::OUTPUT_EDGE))
    expect(out.get_fields).not_to(include("exif-data"))
    expect(output.b).not_to(include("SecretCamera"))
  end

  it "refuses everything that is not a supported image by magic bytes" do
    [
      "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
      "<html><script>1</script></html>",
      "%PDF-1.7 fake",
      "GIF89a<script>",
      "PK\x03\x04zip".b,
      "<?php system($_GET[0]); ?>",
      "\x00\x00\x00\x18ftypmp42".b + "\x00" * 20,
      "\x00\x00\x00\x18ftypisom".b + "\x00" * 20,
    ].each do |body|
      expect(post(body).status).to(eq(422), body[0, 12])
    end
  end

  it "refuses images whose header declares too many pixels" do
    wide = Vips::Image.black(10_001, 1).bandjoin([0, 0]).copy(interpretation: :srgb)
    heavy = Vips::Image.black(7_000, 7_200).bandjoin([0, 0]).copy(interpretation: :srgb)

    expect(post(wide.write_to_buffer(".png")).status).to(eq(422))
    expect(post(heavy.write_to_buffer(".png", compression: 9)).status).to(eq(422))
  end

  it "refuses a corrupt body of a supported type" do
    expect(post(png.byteslice(0, 40)).status).to(eq(422))
  end

  it "rejects oversized, empty and wrong-method requests and unknown paths" do
    expect(request.post("/convert", "CONTENT_LENGTH" => (ImgprocApp::MAX_BYTES + 1).to_s).status).to(eq(413))
    expect(request.post("/convert", input: "", "CONTENT_LENGTH" => "0").status).to(eq(411))
    expect(request.get("/convert").status).to(eq(405))
    expect(request.get("/other").status).to(eq(404))
  end

  it "does not decode loaders libvips flags as untrusted" do
    expect(post("#FITS".b + "\x00" * 100).status).to(eq(422))
    expect(post("P6\n1 1\n255\n\x00\x00\x00".b).status).to(eq(422))
  end
end
