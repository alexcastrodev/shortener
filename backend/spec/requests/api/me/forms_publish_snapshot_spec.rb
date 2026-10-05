require "rails_helper"

RSpec.describe("publishing a form keeps a snapshot", type: :request) do
  include_context "authenticated user"

  let(:question) { { "id" => "abcd1234", "type" => "short_text", "label" => "Name" } }
  let(:form) { Form.create!(user: current_user, title: "Survey", fields: [question]) }

  before { host! "localhost" }

  def json
    JSON.parse(response.body)
  end

  def form_json
    json["form"]
  end

  def publish(target = form)
    post("/api/me/forms/#{target.id}/publish", headers: auth_headers)
  end

  def edit(attrs, target = form)
    patch("/api/me/forms/#{target.id}", params: attrs, headers: auth_headers, as: :json)
  end

  it "starts at version 0 with nothing to discard" do
    get("/api/me/forms/#{form.id}", headers: auth_headers)
    expect(form_json).to(include("published" => false, "published_version" => 0, "has_unpublished_changes" => false))
  end

  it "stores the snapshot, raises the version and records a digest on publish" do
    publish
    expect(response).to(have_http_status(:ok))
    expect(form_json).to(include("published" => true, "published_version" => 1, "has_unpublished_changes" => false))

    form.reload
    expect(form.published_snapshot).to(include("title" => "Survey", "fields" => [question], "layout" => "page"))
    expect(form.published_digest).to(match(/\A\h{64}\z/))
  end

  it "reports unpublished changes after an edit and clears them on the next publish" do
    publish
    edit(title: "Survey v2")
    expect(form_json).to(include("published_version" => 1, "has_unpublished_changes" => true))
    expect(form.reload.published_snapshot["title"]).to(eq("Survey"))

    publish
    expect(form_json).to(include("published_version" => 2, "has_unpublished_changes" => false))
    expect(form.reload.published_snapshot["title"]).to(eq("Survey v2"))
  end

  it "keeps serving the live form publicly for now" do
    publish
    edit(title: "Edited")
    get("/api/public/forms/#{form.public_id}")
    expect(json.dig("form", "title")).to(eq("Edited"))
  end

  it "discards the draft back to the published snapshot" do
    publish
    edit(title: "Changed", description: "Extra", fields: [question.merge("label" => "Other")])
    post("/api/me/forms/#{form.id}/discard", headers: auth_headers)

    expect(response).to(have_http_status(:ok))
    expect(form_json).to(include("title" => "Survey", "has_unpublished_changes" => false, "published_version" => 1))
    expect(form_json["description"]).to(be_nil)
    expect(form_json["fields"]).to(eq([question]))
  end

  it "refuses to discard a form that was never published" do
    post("/api/me/forms/#{form.id}/discard", headers: auth_headers)
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(form.reload.title).to(eq("Survey"))
  end

  it "keeps the snapshot and version when unpublishing" do
    publish
    post("/api/me/forms/#{form.id}/unpublish", headers: auth_headers)
    expect(form_json).to(include("published" => false, "published_version" => 1, "has_unpublished_changes" => false))
    expect(form.reload.published_snapshot).to(be_present)
  end

  it "raises the version again when a form is published after being unpublished" do
    publish
    post("/api/me/forms/#{form.id}/unpublish", headers: auth_headers)
    publish
    expect(form_json["published_version"]).to(eq(2))
  end

  it "refuses to publish a form without questions and leaves the version alone" do
    empty = Form.create!(user: current_user, title: "Empty")
    publish(empty)
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(empty.reload).to(have_attributes(published: false, published_version: 0, published_snapshot: nil))
  end

  it "does not report changes for a form whose snapshot was backfilled" do
    published = Form.create!(user: current_user, title: "Old", description: "Hello", fields: [question], published: true)
    Forms::BackfillSnapshots.call
    get("/api/me/forms/#{published.id}", headers: auth_headers)
    expect(form_json).to(include("published_version" => 1, "has_unpublished_changes" => false))
  end

  it "does not let another user publish or discard the form" do
    other = FactoryBot.create(:user)
    other_form = Form.create!(user: other, title: "Theirs", fields: [question])
    publish(other_form)
    expect(response).to(have_http_status(:not_found))
    post("/api/me/forms/#{other_form.id}/discard", headers: auth_headers)
    expect(response).to(have_http_status(:not_found))
    expect(other_form.reload.published_version).to(eq(0))
  end

  it "answers 401 without a token" do
    post("/api/me/forms/#{form.id}/discard")
    expect(response).to(have_http_status(:unauthorized))
  end
end
