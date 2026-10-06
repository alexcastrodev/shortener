require "rails_helper"

RSpec.describe("public form read from the published snapshot", type: :request) do
  include_context "authenticated user"

  let(:owner) { current_user }
  let(:name) { { "id" => "name0001", "type" => "short_text", "label" => "Name", "required" => true } }
  let(:mail) { { "id" => "mail0001", "type" => "email", "label" => "Mail" } }
  let(:form) { Form.create!(user: owner, title: "Survey", fields: [name, mail]) }
  let(:ip) { { "CF-Connecting-IP" => "198.51.100.7" } }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("FORM_DRAFTS_ENABLED").and_return("true"))
    Forms::Publish.call(form: form)
  end

  def json
    JSON.parse(response.body)
  end

  def public_form
    get("/api/public/forms/#{form.public_id}")
    json["form"]
  end

  def submit(answers, version: nil)
    body = { answers: answers, turnstile_token: "t" }
    body[:form_version] = version unless version.nil?
    post("/api/public/forms/#{form.public_id}/responses", params: body, headers: ip, as: :json)
  end

  def sheet_text
    Zip::File.open_buffer(StringIO.new(response.body)).read("xl/worksheets/sheet1.xml")
  end

  def remove_field(id)
    delete("/api/me/forms/#{form.id}/fields/#{id}", headers: auth_headers)
    expect(response).to(have_http_status(:ok))
  end

  def edit(attrs)
    patch("/api/me/forms/#{form.id}", params: attrs, headers: auth_headers, as: :json)
  end

  it "serves the published version and its number" do
    expect(public_form).to(include("title" => "Survey", "published_version" => 1))
  end

  it "does not show draft edits until they are published" do
    edit(title: "Draft title")
    remove_field("mail0001")
    shown = public_form
    expect(shown["title"]).to(eq("Survey"))
    expect(shown["fields"].map { |field| field["id"] }).to(eq(["name0001", "mail0001"]))

    Forms::Publish.call(form: form.reload)
    shown = public_form
    expect(shown).to(include("title" => "Draft title", "published_version" => 2))
    expect(shown["fields"].map { |field| field["id"] }).to(eq(["name0001"]))
  end

  it "keeps the closed key list and hides the version when the flag is off" do
    allow(ENV).to(receive(:[]).with("FORM_DRAFTS_ENABLED").and_return(nil))
    expect(public_form.keys).to(match_array(["title", "description", "thank_you_message", "theme", "custom_colors", "layout", "fields", "cover_token", "cover_position", "intro_enabled", "start_label"]))
  end

  it "stores the version the visitor saw and accepts a submission without one" do
    submit({ "name0001" => "Ana" })
    expect(response).to(have_http_status(:created))
    expect(FormResponse.last.published_version).to(eq(1))
  end

  it "accepts a submission made against the current version" do
    submit({ "name0001" => "Ana" }, version: 1)
    expect(response).to(have_http_status(:created))
  end

  it "validates against the published fields, not the draft" do
    patch("/api/me/forms/#{form.id}/fields/mail0001", params: { required: true }, headers: auth_headers, as: :json)
    expect(response).to(have_http_status(:ok))
    submit({ "name0001" => "Ana" }, version: 1)
    expect(response).to(have_http_status(:created))
  end

  it "answers 409 form_changed with the new form when the version is old, and stores nothing" do
    edit(title: "Second")
    Forms::Publish.call(form: form.reload)

    expect { submit({ "name0001" => "Ana" }, version: 1) }.not_to(change(FormResponse, :count))
    expect(response).to(have_http_status(:conflict))
    expect(json["error"]).to(eq("form_changed"))
    expect(json["form"]).to(include("title" => "Second", "published_version" => 2))
    expect(json["form"].keys).not_to(include("user_id", "public_id"))
  end

  it "ignores the version when the flag is off" do
    allow(ENV).to(receive(:[]).with("FORM_DRAFTS_ENABLED").and_return(nil))
    submit({ "name0001" => "Ana" }, version: 99)
    expect(response).to(have_http_status(:created))
    expect(FormResponse.last.published_version).to(be_nil)
  end

  it "returns the earlier response for a retried idempotency key even if the form changed" do
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: { "name0001" => "Ana" }, turnstile_token: "t", idempotency_key: "k1", form_version: 1 }, headers: ip, as: :json)
    expect(response).to(have_http_status(:created))
    Forms::Publish.call(form: form.reload.tap { |f| f.update!(title: "Changed") })

    post("/api/public/forms/#{form.public_id}/responses", params: { answers: { "name0001" => "Ana" }, turnstile_token: "t", idempotency_key: "k1", form_version: 1 }, headers: ip, as: :json)
    expect(response).to(have_http_status(:ok))
    expect(FormResponse.count).to(eq(1))
  end

  describe "summary and export keep removed questions visible" do
    before do
      submit({ "name0001" => "Ana", "mail0001" => "ana@example.com" })
      remove_field("mail0001")
    end

    it "lists a question removed from the draft but still live in the summary" do
      get("/api/me/forms/#{form.id}/summary", headers: auth_headers)
      expect(response).to(have_http_status(:ok))
      expect(json["fields"].map { |field| field["id"] }).to(match_array(["name0001", "mail0001"]))
    end

    it "keeps its column in the export" do
      get("/api/me/forms/#{form.id}/responses_export", headers: auth_headers)
      expect(response).to(have_http_status(:ok))
      expect(sheet_text).to(include("Mail", "ana@example.com"))
    end

    it "drops it from the summary once the removal is published" do
      Forms::Publish.call(form: form.reload)
      get("/api/me/forms/#{form.id}/summary", headers: auth_headers)
      expect(json["fields"].map { |field| field["id"] }).to(eq(["name0001"]))
    end
  end
end
