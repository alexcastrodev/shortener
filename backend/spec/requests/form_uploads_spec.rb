require "rails_helper"

RSpec.describe("Form image uploads", type: :request) do
  let(:owner) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:fields) do
    [
      { "id" => "name0001", "type" => "short_text", "label" => "Name" },
      { "id" => "photo001", "type" => "image", "label" => "Photo" },
      { "id" => "photo002", "type" => "image", "label" => "Second" },
    ]
  end
  let!(:form) { Form.create!(user: owner, title: "Bugs", published: true, fields: fields) }
  let(:webp) { Vips::Image.black(8, 8).bandjoin([0, 0]).copy(interpretation: :srgb).write_to_buffer(".webp") }
  let(:png) { Vips::Image.black(8, 8).bandjoin([0, 0]).copy(interpretation: :srgb).write_to_buffer(".png") }
  let(:path) { "/api/public/forms/#{form.public_id}/fields/photo001/uploads" }

  around do |example|
    ENV["IMGPROC_URL"] = "http://imgproc.test"
    example.run
  ensure
    ENV.delete("IMGPROC_URL")
  end

  before do
    host! "localhost"
    stub_request(:post, "http://imgproc.test/convert").to_return(status: 200, body: webp)
  end

  def upload(data = png, name: "x.png", type: "image/png", target: path)
    file = Rack::Test::UploadedFile.new(StringIO.new(data), type, original_filename: name)
    post(target, params: { file: file })
  end

  def submit(answers, key: nil)
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, idempotency_key: key }, as: :json)
  end

  def token
    JSON.parse(response.body)["token"]
  end

  def bearer(user)
    { "Authorization" => "Bearer #{SessionToken.issue(user)}" }
  end

  describe "uploading" do
    it "converts through imgproc, stores WebP under a constant name and returns a token" do
      upload

      expect(response).to(have_http_status(:created))
      stored = FormUpload.find_by!(token: token)
      expect(stored.response_id).to(be_nil)
      expect(stored.file.content_type).to(eq("image/webp"))
      expect(stored.file.filename.to_s).to(eq("image.webp"))
      expect(stored.file.download.b).to(start_with("RIFF".b))
      expect(stored.file.blob.key).to(match(/\A[a-z0-9]{28}\z/))
    end

    it "never sends bytes that are not an image by magic to imgproc" do
      ["<svg><script>alert(1)</script></svg>", "<html></html>", "%PDF-1.7", "GIF89a<script>", "PK\x03\x04zip".b, "<?php ?>"].each do |body|
        upload(body, name: "evil.png")

        expect(response).to(have_http_status(:unprocessable_content), body[0, 10])
      end
      expect(a_request(:post, "http://imgproc.test/convert")).not_to(have_been_made)
      expect(FormUpload.count).to(eq(0))
    end

    it "maps imgproc rejection to 422 and an unavailable sandbox to 503 without leaving rows" do
      stub_request(:post, "http://imgproc.test/convert").to_return(status: 422)
      upload
      expect(response).to(have_http_status(:unprocessable_content))

      [500, 502].each do |status|
        stub_request(:post, "http://imgproc.test/convert").to_return(status: status)
        upload
        expect(response).to(have_http_status(:service_unavailable))
        expect(JSON.parse(response.body)).to(eq("error" => "uploads_unavailable"))
      end

      stub_request(:post, "http://imgproc.test/convert").to_timeout
      upload
      expect(response).to(have_http_status(:service_unavailable))
      expect(FormUpload.count).to(eq(0))
    end

    it "answers 503 and leaves nothing behind when storage fails, without leaking its details" do
      allow_any_instance_of(ActiveStorage::Attached::One).to(receive(:attach).and_raise(Aws::S3::Errors::ServiceError.new(nil, "bucket kurz-forms at http://s3:8333 is full")))

      upload

      expect(response).to(have_http_status(:service_unavailable))
      expect(response.body).not_to(match(/kurz-forms|8333|bucket/))
      expect(FormUpload.count).to(eq(0))
    end

    it "requires multipart, limits the body and the file size, and rejects non-multipart bodies" do
      post(path, params: { file: "x" }, as: :json)
      expect(response).to(have_http_status(:unsupported_media_type))

      post(path, params: { file: "not a file" })
      expect(response).to(have_http_status(:unsupported_media_type))

      upload(png + ("0" * 11.megabytes))
      expect(response).to(have_http_status(:content_too_large))
    end

    it "404s for unpublished forms, unknown, non-image and malformed ids" do
      form.update!(published: false)
      upload
      expect(response).to(have_http_status(:not_found))

      form.update!(published: true)
      ["/api/public/forms/#{form.public_id}/fields/name0001/uploads", "/api/public/forms/#{form.public_id}/fields/nope0000/uploads", "/api/public/forms/#{form.public_id}/fields/x/uploads", "/api/public/forms/short/fields/photo001/uploads"].each do |target|
        upload(target: target)
        expect(response).to(have_http_status(:not_found), target)
      end
    end

    it "stops accepting uploads once the total stored reaches the cap, without touching the sandbox" do
      stub_const("FormUpload::MAX_TOTAL_BYTES", 100)
      upload
      expect(response).to(have_http_status(:created))
      Rails.cache.clear

      upload

      expect(response).to(have_http_status(:service_unavailable))
      expect(JSON.parse(response.body)).to(eq("error" => "uploads_unavailable"))
      expect(a_request(:post, "http://imgproc.test/convert")).to(have_been_made.once)
    end

    it "limits uploads per IP" do
      15.times { upload }
      expect(response).to(have_http_status(:created))

      upload
      expect(response).to(have_http_status(:too_many_requests))
    end
  end

  describe "submitting" do
    it "attaches the upload to the response and stores only the token as the answer" do
      upload
      photo = token

      submit({ "name0001" => "Ana", "photo001" => photo })

      expect(response).to(have_http_status(:created))
      saved = FormResponse.last
      expect(saved.answers).to(eq("name0001" => "Ana", "photo001" => photo))
      expect(FormUpload.find_by!(token: photo).response_id).to(eq(saved.id))
    end

    it "refuses a token twice, for another field, for another form or made up" do
      upload
      photo = token
      submit({ "photo001" => photo })
      expect(response).to(have_http_status(:created))

      submit({ "photo001" => photo })
      expect(response).to(have_http_status(:unprocessable_content))

      upload
      fresh = token
      submit({ "photo002" => fresh })
      expect(response).to(have_http_status(:unprocessable_content))

      foreign = Form.create!(user: other, title: "X", published: true, fields: [{ "id" => "photo001", "type" => "image", "label" => "P" }])
      stolen = foreign.uploads.create!(field_id: "photo001")
      submit({ "photo001" => stolen.token })
      expect(response).to(have_http_status(:unprocessable_content))

      Rails.cache.clear
      ["a" * 24, "short", 12, ["x"], { "a" => 1 }].each do |bad|
        submit({ "photo001" => bad })
        expect(response).to(have_http_status(:unprocessable_content), "#{bad.inspect} -> #{response.status} #{response.body}")
      end
      expect(FormResponse.count).to(eq(1))
    end

    it "keeps the image optional unless the field is required and rolls back when the claim fails" do
      form.update!(fields: fields.map { |field| field["id"] == "photo001" ? field.merge("required" => true) : field })
      submit({ "name0001" => "Ana" })
      expect(response).to(have_http_status(:unprocessable_content))

      upload
      photo = token
      allow(FormUpload).to(receive(:where).and_wrap_original { |original, *args| args.first.is_a?(Hash) && args.first.key?(:id) ? FormUpload.none : original.call(*args) })
      submit({ "photo001" => photo })
      expect(response).to(have_http_status(:unprocessable_content))
      expect(FormResponse.count).to(eq(0))
    end

    it "is idempotent: a retry with the same key claims nothing twice" do
      upload
      photo = token
      submit({ "photo001" => photo }, key: "k1")
      submit({ "photo001" => photo }, key: "k1")

      expect(response).to(have_http_status(:ok))
      expect(FormResponse.count).to(eq(1))
    end
  end

  describe "owner download" do
    let!(:stored) do
      upload
      photo = token
      submit({ "photo001" => photo })
      FormUpload.find_by!(token: photo)
    end
    let(:url) { "/api/me/forms/#{form.id}/uploads/#{stored.token}" }

    it "serves the WebP only to the owner, as a private attachment with no sniffing or script" do
      get(url)
      expect(response).to(have_http_status(:unauthorized))

      get(url, headers: bearer(other))
      expect(response).to(have_http_status(:not_found))

      get(url, headers: bearer(owner))
      expect(response).to(have_http_status(:ok))
      expect(response.media_type).to(eq("image/webp"))
      expect(response.headers["Content-Disposition"]).to(start_with("attachment"))
      expect(response.headers["Cache-Control"]).to(include("no-store"))
      expect(response.headers["Cache-Control"]).to(include("private"))
      expect(response.headers["X-Content-Type-Options"]).to(eq("nosniff"))
      expect(response.headers["Content-Security-Policy"]).to(eq("default-src 'none'; sandbox"))
      expect(response.body.b).to(start_with("RIFF".b))
      expect(response.headers.keys.join).not_to(match(/signature|storage/i))
    end

    it "does not serve uploads that were never submitted" do
      upload
      get("/api/me/forms/#{form.id}/uploads/#{token}", headers: bearer(owner))

      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "cleanup and deletion" do
    it "removes orphans after an hour and keeps fresh and attached ones" do
      upload
      fresh = FormUpload.find_by!(token: token)
      upload
      old = FormUpload.find_by!(token: token)
      old.update_columns(created_at: 2.hours.ago)
      upload
      attached = FormUpload.find_by!(token: token)
      submit({ "photo001" => attached.token })
      attached.update_columns(created_at: 2.hours.ago)

      perform_enqueued_jobs { CleanupOrphanFormUploadsJob.perform_now }

      expect(FormUpload.where(id: [fresh.id, attached.id]).count).to(eq(2))
      expect(FormUpload.exists?(old.id)).to(be(false))
    end

    it "purges rows and blobs when a response, all responses or the form are deleted" do
      uploads = Array.new(3) do
        upload
        photo = token
        submit({ "photo001" => photo })
        FormUpload.find_by!(token: photo)
      end
      blobs = uploads.map { |item| item.file.blob_id }

      perform_enqueued_jobs { delete("/api/me/forms/#{form.id}/responses/#{FormResponse.first.id}", headers: bearer(owner)) }
      expect(FormUpload.count).to(eq(2))

      perform_enqueued_jobs { delete("/api/me/forms/#{form.id}/responses", headers: bearer(owner)) }
      expect(FormUpload.count).to(eq(0))

      upload
      photo = token
      submit({ "photo001" => photo })
      perform_enqueued_jobs { delete("/api/me/forms/#{form.id}", headers: bearer(owner)) }
      expect(FormUpload.count).to(eq(0))
      expect(ActiveStorage::Blob.where(id: blobs)).to(be_empty)
      expect(ActiveStorage::Attachment.count).to(eq(0))
    end
  end

  describe "MCP and summaries" do
    it "never hands the upload token to a reader and counts answered images in the summary" do
      upload
      photo = token
      submit({ "photo001" => photo })

      summary = Forms::Summary.call(form: form, text_samples: false)

      expect(summary[:fields].find { |field| field[:id] == "photo001" }[:answered]).to(eq(1))
      value = Mcp::Tools::ResponseToolHelpers.value_for(fields[1], photo, Mcp::Untrusted.budget(1000))
      expect(value).to(eq("(image attached)"))
    end
  end

  describe "ActiveStorage routes" do
    it "never serve the blob of a form upload, even with a valid signed id" do
      upload
      stored = FormUpload.find_by!(token: token)
      sid = stored.file.blob.signed_id

      [
        "/rails/active_storage/blobs/redirect/#{sid}/image.webp",
        "/rails/active_storage/blobs/proxy/#{sid}/image.webp",
        "/rails/active_storage/blobs/#{sid}/image.webp",
      ].each do |target|
        get(target)

        expect(response).not_to(have_http_status(:ok), target)
        expect(response.body.b).not_to(start_with("RIFF".b), target)
      end
    end
  end
end
