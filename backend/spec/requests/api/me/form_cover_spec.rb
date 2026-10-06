require "rails_helper"

RSpec.describe("the form cover and intro", type: :request) do
  include_context "authenticated user"

  let(:question) { { "id" => "abcd1234", "type" => "short_text", "label" => "Name" } }
  let(:form) { Form.create!(user: current_user, title: "Salon", fields: [question]) }
  let(:other_user) { User.create!(email: "other+#{SecureRandom.hex(4)}@example.com") }
  let(:other_headers) { { "Authorization" => "Bearer #{SessionToken.issue(other_user)}" } }
  let(:webp) { Vips::Image.black(8, 8).bandjoin([0, 0]).copy(interpretation: :srgb).write_to_buffer(".webp") }
  let(:png) { Vips::Image.black(8, 8).bandjoin([0, 0]).copy(interpretation: :srgb).write_to_buffer(".png") }
  let(:cover_path) { "/api/me/forms/#{form.id}/cover" }

  around do |example|
    ENV["IMGPROC_URL"] = "http://imgproc.test"
    example.run
  ensure
    ENV.delete("IMGPROC_URL")
  end

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("FORM_DRAFTS_ENABLED").and_return("true"))
    stub_request(:post, "http://imgproc.test/convert").to_return(status: 200, body: webp)
  end

  def json = JSON.parse(response.body)

  def upload(data = png, headers: auth_headers, target: cover_path, type: "image/png")
    file = Rack::Test::UploadedFile.new(StringIO.new(data), type, original_filename: "cover.png")
    put(target, params: { file: file }, headers: headers)
  end

  def publish!(target = form)
    post("/api/me/forms/#{target.id}/publish", headers: auth_headers)
  end

  def edit(attrs)
    patch("/api/me/forms/#{form.id}", params: attrs, headers: auth_headers, as: :json)
  end

  def public_cover(token, public_id: form.public_id)
    get("/api/public/forms/#{public_id}/cover/#{token}", headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" })
  end

  describe "uploading" do
    it "stores a WebP made by imgproc and points the draft at it" do
      upload
      expect(response).to(have_http_status(:ok))
      token = json["form"]["cover_token"]
      expect(token).to(match(/\A[A-Za-z0-9]{24}\z/))
      stored = form.reload.cover
      expect(stored.file.content_type).to(eq("image/webp"))
      expect(stored.file.download.b).to(start_with("RIFF".b))
      expect(stored.response_id).to(be_nil)
    end

    it "lets the owner see the draft cover, sandboxed and never cached" do
      upload
      get(cover_path, headers: auth_headers)
      expect(response).to(have_http_status(:ok))
      expect(response.media_type).to(eq("image/webp"))
      expect(response.headers["Content-Security-Policy"]).to(include("sandbox"))
      expect(response.headers["Cache-Control"]).to(include("no-store"))
    end

    it "replaces the cover and deletes the old file when nothing published uses it" do
      upload
      first = form.reload.cover_token
      upload
      expect(form.reload.cover_token).not_to(eq(first))
      expect(FormUpload.where(token: first)).to(be_empty)
      expect(form.uploads.where(field_id: Form::COVER_FIELD).count).to(eq(1))
    end

    it "never sends content that is not a PNG, JPEG or WebP by its bytes to imgproc" do
      ["<svg><script>alert(1)</script></svg>", "GIF89a<script>", "%PDF-1.7", "<html></html>".b].each do |body|
        upload(body)
        expect(response).to(have_http_status(:unprocessable_content), body[0, 8])
        expect(json["error"]).to(eq("invalid_image"))
      end
      expect(a_request(:post, "http://imgproc.test/convert")).not_to(have_been_made)
      expect(FormUpload.count).to(eq(0))
    end

    it "refuses a HEIC photo, which avatars accept but covers do not" do
      upload(File.binread(Rails.root.join("spec/fixtures/files/avatar.heic")), type: "image/heic")
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "refuses a file over 5 MB" do
      upload(png + ("0" * 5.megabytes))
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["message"]).to(include("5MB"))
    end

    it "refuses a huge canvas hidden in a tiny file, by side and by pixel count" do
      [Vips::Image.black(8_001, 1), Vips::Image.black(7_000, 7_000)].each do |image|
        upload(image.write_to_buffer(".png"))
        expect(response).to(have_http_status(:unprocessable_content))
      end
      expect(a_request(:post, "http://imgproc.test/convert")).not_to(have_been_made)
    end

    it "asks for multipart, and for a file" do
      put(cover_path, params: { file: "x" }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:unsupported_media_type))
      put(cover_path, params: { other: Rack::Test::UploadedFile.new(StringIO.new(png), "image/png", original_filename: "x.png") }, headers: auth_headers)
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "maps an imgproc rejection to 422 and an unavailable sandbox to 503, leaving nothing behind" do
      stub_request(:post, "http://imgproc.test/convert").to_return(status: 422)
      upload
      expect(response).to(have_http_status(:unprocessable_content))
      stub_request(:post, "http://imgproc.test/convert").to_return(status: 502)
      upload
      expect(response).to(have_http_status(:service_unavailable))
      expect(FormUpload.count).to(eq(0))
      expect(form.reload.cover_token).to(be_nil)
    end

    it "is refused for strangers, other people's forms and signed-out visitors" do
      upload(headers: other_headers)
      expect(response).to(have_http_status(:not_found))
      upload(headers: {})
      expect(response).to(have_http_status(:unauthorized))
      get(cover_path, headers: other_headers)
      expect(response).to(have_http_status(:not_found))
      delete(cover_path, headers: other_headers)
      expect(response).to(have_http_status(:not_found))
      expect(form.reload.cover_token).to(be_nil)
    end

    it "keeps a cover out of the orphan sweep" do
      upload
      travel_to(2.hours.from_now) { CleanupOrphanFormUploadsJob.perform_now }
      expect(form.reload.cover).to(be_present)
    end
  end

  describe "removing" do
    it "clears the draft and deletes the file" do
      upload
      token = form.reload.cover_token
      delete(cover_path, headers: auth_headers)
      expect(response).to(have_http_status(:ok))
      expect(json["form"]["cover_token"]).to(be_nil)
      expect(FormUpload.where(token: token)).to(be_empty)
      get(cover_path, headers: auth_headers)
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "what visitors see" do
    it "shows no cover until the form is published with it" do
      upload
      token = form.reload.cover_token
      form.update!(published: true, published_snapshot: Forms::Snapshot.of(form.tap { |item| item.cover_token = nil }))
      public_cover(token)
      expect(response).to(have_http_status(:not_found))
    end

    it "serves the published cover as a sandboxed WebP and lists it in the public form" do
      upload
      publish!
      token = form.reload.cover_token
      get("/api/public/forms/#{form.public_id}", headers: { "CF-Connecting-IP" => "198.51.100.9" })
      expect(json["form"]).to(include("cover_token" => token, "cover_position" => 50, "intro_enabled" => false, "start_label" => nil))
      public_cover(token)
      expect(response).to(have_http_status(:ok))
      expect(response.media_type).to(eq("image/webp"))
      expect(response.headers["Content-Security-Policy"]).to(include("sandbox"))
    end

    it "keeps showing the published cover while a new one is a draft, then switches on publish" do
      upload
      publish!
      old = form.reload.cover_token
      upload
      fresh = form.reload.cover_token
      public_cover(old)
      expect(response).to(have_http_status(:ok))
      public_cover(fresh)
      expect(response).to(have_http_status(:not_found))
      expect(form.uploads.where(field_id: Form::COVER_FIELD).count).to(eq(2))

      publish!
      public_cover(fresh)
      expect(response).to(have_http_status(:ok))
      public_cover(old)
      expect(response).to(have_http_status(:not_found))
      expect(FormUpload.where(token: old)).to(be_empty)
    end

    it "keeps the published cover when the draft cover is removed" do
      upload
      publish!
      token = form.reload.cover_token
      delete(cover_path, headers: auth_headers)
      public_cover(token)
      expect(response).to(have_http_status(:ok))
    end

    it "does not serve another form's cover under this form's address, or a malformed token" do
      upload
      publish!
      token = form.reload.cover_token
      other_form = Form.create!(user: current_user, title: "Other", fields: [question], published: true)
      public_cover(token, public_id: other_form.public_id)
      expect(response).to(have_http_status(:not_found))
      public_cover("short")
      expect(response).to(have_http_status(:not_found))
      public_cover("A" * 24)
      expect(response).to(have_http_status(:not_found))
    end

    it "stops serving it when the owner is deactivated or the form is unpublished" do
      upload
      publish!
      token = form.reload.cover_token
      post("/api/me/forms/#{form.id}/unpublish", headers: auth_headers)
      public_cover(token)
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "the intro screen and its button" do
    it "stores the position, the switch and the button text, and flags them as unpublished changes" do
      publish!
      edit(cover_position: 20, intro_enabled: true, start_label: "Let's go")
      expect(response).to(have_http_status(:ok))
      expect(json["form"]).to(include("cover_position" => 20, "intro_enabled" => true, "start_label" => "Let's go", "has_unpublished_changes" => true))
      get("/api/public/forms/#{form.public_id}", headers: { "CF-Connecting-IP" => "198.51.100.10" })
      expect(json["form"]).to(include("cover_position" => 50, "intro_enabled" => false, "start_label" => nil))
      publish!
      get("/api/public/forms/#{form.public_id}", headers: { "CF-Connecting-IP" => "198.51.100.10" })
      expect(json["form"]).to(include("cover_position" => 20, "intro_enabled" => true, "start_label" => "Let's go"))
    end

    it "rejects a position outside 0 to 100 and a button text over 40 characters" do
      edit(cover_position: 101)
      expect(response).to(have_http_status(:unprocessable_content))
      edit(cover_position: -1)
      expect(response).to(have_http_status(:unprocessable_content))
      edit(start_label: "x" * 41)
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "does not flag a form published before covers existed as changed" do
      old_snapshot = Forms::Snapshot.of(form).except(*Forms::Snapshot::DEFAULTS.keys)
      form.update!(published: true, published_snapshot: old_snapshot, published_version: 1)
      get("/api/me/forms/#{form.id}", headers: auth_headers)
      expect(json["form"]["has_unpublished_changes"]).to(be(false))
      get("/api/public/forms/#{form.public_id}", headers: { "CF-Connecting-IP" => "198.51.100.11" })
      expect(response).to(have_http_status(:ok))
      expect(json["form"]).to(include("cover_token" => nil, "intro_enabled" => false))
    end

    it "brings the published cover back when the draft is discarded" do
      upload
      publish!
      published = form.reload.cover_token
      upload
      post("/api/me/forms/#{form.id}/discard", headers: auth_headers)
      expect(form.reload.cover_token).to(eq(published))
      expect(form.uploads.where(field_id: Form::COVER_FIELD).count).to(eq(1))
    end
  end
end
