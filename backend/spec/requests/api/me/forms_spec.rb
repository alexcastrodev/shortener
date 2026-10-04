require "rails_helper"

RSpec.describe("/api/me/forms", type: :request) do
  include_context "authenticated user"

  let(:json) { JSON.parse(response.body) }
  let(:form_json) { json["form"] }
  let(:other_user) { FactoryBot.create(:user) }
  let(:field) { { "id" => "abcd1234", "type" => "yes_no", "label" => "Ok?" } }

  before do
    host! "localhost"
  end

  def make_form(user: current_user, **attrs)
    Form.create!({ user: user, title: "Mine" }.merge(attrs))
  end

  def post_form(params)
    post("/api/me/forms", params: params, headers: auth_headers, as: :json)
  end

  describe "authentication" do
    it "answers 401 without a token on every route" do
      form = make_form
      [
        [:get, "/api/me/forms"],
        [:post, "/api/me/forms"],
        [:get, "/api/me/forms/#{form.id}"],
        [:patch, "/api/me/forms/#{form.id}"],
        [:delete, "/api/me/forms/#{form.id}"],
        [:post, "/api/me/forms/#{form.id}/publish"],
        [:post, "/api/me/forms/#{form.id}/unpublish"],
      ].each do |verb, path|
        send(verb, path)
        expect(response).to(have_http_status(:unauthorized), "#{verb} #{path}")
      end
    end
  end

  describe "GET /api/me/forms" do
    it "lists only the current user's forms, newest first" do
      older = make_form(title: "Older", created_at: 2.days.ago)
      newer = make_form(title: "Newer")
      make_form(user: other_user, title: "Not mine")

      get "/api/me/forms", headers: auth_headers

      expect(response).to(have_http_status(:ok))
      expect(json["form"].map { |f| f["id"] }).to(eq([newer.id, older.id]))
    end
  end

  describe "POST /api/me/forms" do
    it "creates an unpublished form and answers with the owner payload" do
      post_form(title: "Contact", description: "Say hi")

      expect(response).to(have_http_status(:created))
      expect(form_json.keys).to(match_array(["id", "created_at", "updated_at", "public_id", "title", "description", "thank_you_message", "theme", "published", "fields", "responses_count", "public_url"]))
      expect(form_json).to(include("title" => "Contact", "published" => false, "fields" => [], "responses_count" => 0))
      expect(form_json["public_id"]).to(match(/\A[A-Za-z0-9]{12}\z/))
    end

    it "ignores attributes the client must not set" do
      post_form(title: "Sneaky", user_id: other_user.id, published: true, responses_count: 99, public_id: "AAAAAAAAAAAA", id: 1, fields: [field])

      expect(response).to(have_http_status(:created))
      form = Form.find(form_json["id"])
      expect(form.user).to(eq(current_user))
      expect(form).to(have_attributes(published: false, responses_count: 0, fields: []))
      expect(form.public_id).not_to(eq("AAAAAAAAAAAA"))
    end

    it "builds the form from a built-in template, keeping the given title" do
      post_form(title: "My contact form", template: "contact")

      expect(response).to(have_http_status(:created))
      expect(form_json["title"]).to(eq("My contact form"))
      expect(form_json["fields"].size).to(eq(3))
      expect(form_json["thank_you_message"]).to(be_present)
    end

    it "rejects an unknown template, including community ones" do
      post_form(title: "x", template: "community-1")

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(Form.count).to(eq(0))
    end

    it "answers 422 with errors by attribute" do
      post_form(title: "x", theme: "neon")
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]).to(have_key("theme"))

      post_form(title: "")
      expect(response).to(have_http_status(:unprocessable_entity))
    end

    it "stops at the daily quota with 429 forms_daily_limit, per user" do
      Form::MAX_CREATED_PER_DAY.times { |i| make_form(title: "F#{i}") }

      post_form(title: "one more")

      expect(response).to(have_http_status(:too_many_requests))
      expect(json).to(eq("error" => "forms_daily_limit"))
      expect(current_user.forms.count).to(eq(Form::MAX_CREATED_PER_DAY))

      post "/api/me/forms", params: { title: "mine" }, headers: { "Authorization" => "Bearer #{SessionToken.issue(other_user)}" }, as: :json
      expect(response).to(have_http_status(:created))
    end
  end

  describe "GET/PATCH/DELETE /api/me/forms/:id" do
    let!(:form) { make_form }

    it "shows, updates and deletes the owner's form" do
      get "/api/me/forms/#{form.id}", headers: auth_headers
      expect(response).to(have_http_status(:ok))

      patch "/api/me/forms/#{form.id}", params: { title: "Renamed", theme: "ocean" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:ok))
      expect(form.reload).to(have_attributes(title: "Renamed", theme: "ocean"))

      delete "/api/me/forms/#{form.id}", headers: auth_headers
      expect(response).to(have_http_status(:no_content))
      expect(Form.exists?(form.id)).to(be(false))
    end

    it "does not let update change published, fields, owner or counters" do
      patch "/api/me/forms/#{form.id}", params: { title: "Ok", published: true, fields: [field], user_id: other_user.id, responses_count: 5, public_id: "ZZZZZZZZZZZZ" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:ok))
      expect(form.reload).to(have_attributes(published: false, fields: [], user_id: current_user.id, responses_count: 0))
      expect(form.public_id).not_to(eq("ZZZZZZZZZZZZ"))
    end

    it "answers 422 for an invalid update" do
      patch "/api/me/forms/#{form.id}", params: { title: "a" * 121 }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]).to(have_key("title"))
    end

    it "answers another user's form exactly like a missing one" do
      theirs = make_form(user: other_user)

      [
        [:get, "", {}],
        [:patch, "", { title: "hijack" }],
        [:delete, "", {}],
        [:post, "/publish", {}],
        [:post, "/unpublish", {}],
      ].each do |verb, suffix, params|
        options = params.empty? ? { headers: auth_headers } : { params: params, headers: auth_headers, as: :json }
        send(verb, "/api/me/forms/#{theirs.id}#{suffix}", **options)
        taken = [response.status, response.body]
        send(verb, "/api/me/forms/0#{suffix}", **options)

        expect(taken).to(eq([404, response.body]), "#{verb} #{suffix}")
      end
      expect(theirs.reload).to(have_attributes(title: "Mine", published: false))
      expect(Form.exists?(theirs.id)).to(be(true))
    end
  end

  describe "publish and unpublish" do
    it "refuses to publish a form without questions" do
      form = make_form

      post "/api/me/forms/#{form.id}/publish", headers: auth_headers

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(form.reload.published).to(be(false))
    end

    it "publishes and unpublishes a form that has questions" do
      form = make_form(fields: [field])

      post "/api/me/forms/#{form.id}/publish", headers: auth_headers
      expect(response).to(have_http_status(:ok))
      expect(form.reload.published).to(be(true))

      post "/api/me/forms/#{form.id}/unpublish", headers: auth_headers
      expect(form.reload.published).to(be(false))
    end
  end

  describe "fields" do
    let!(:form) { make_form }

    def field_ids
      form.reload.fields.map { |f| f["id"] }
    end

    it "adds, updates, reorders and removes questions" do
      post "/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: "Name", required: true }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:created))
      post "/api/me/forms/#{form.id}/fields", params: { type: "single_choice", label: "Pick", choices: [{ label: "a" }, { label: "b" }] }, headers: auth_headers, as: :json
      first, second = field_ids
      expect(second).to(be_present)

      patch "/api/me/forms/#{form.id}/fields/#{first}", params: { label: "Full name" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:ok))
      expect(json["form"]["fields"].first).to(include("label" => "Full name", "required" => true))

      patch "/api/me/forms/#{form.id}/fields/reorder", params: { ids: [second, first] }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:ok))
      expect(field_ids).to(eq([second, first]))

      delete "/api/me/forms/#{form.id}/fields/#{second}", headers: auth_headers
      expect(response).to(have_http_status(:ok))
      expect(field_ids).to(eq([first]))
    end

    it "answers 422 for an invalid question and for a type change" do
      post "/api/me/forms/#{form.id}/fields", params: { type: "rating", label: "x", scale: 7 }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]).to(have_key("fields"))

      post "/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: "x" }, headers: auth_headers, as: :json
      id = field_ids.first
      patch "/api/me/forms/#{form.id}/fields/#{id}", params: { type: "email" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:unprocessable_entity))
    end

    it "answers 422 for a reorder that is not a permutation" do
      post "/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: "x" }, headers: auth_headers, as: :json

      patch "/api/me/forms/#{form.id}/fields/reorder", params: { ids: [field_ids.first, "zzzzzzzz"] }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]).to(have_key("ids"))
    end

    it "does not accept a client-chosen field id or keys outside the contract" do
      post "/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: "x", id: "hacked00", evil: 1 }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:created))
      expect(form.reload.fields.first.keys).to(match_array(["id", "type", "label"]))
      expect(form.fields.first["id"]).not_to(eq("hacked00"))
    end

    it "treats another user's form and a field of another form as not found" do
      theirs = make_form(user: other_user, fields: [field])
      mine = make_form(fields: [{ "id" => "mine0001", "type" => "yes_no", "label" => "m" }])

      post "/api/me/forms/#{theirs.id}/fields", params: { type: "short_text", label: "x" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:not_found))
      patch "/api/me/forms/#{theirs.id}/fields/abcd1234", params: { label: "x" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:not_found))
      patch "/api/me/forms/#{mine.id}/fields/abcd1234", params: { label: "x" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:not_found))
      delete "/api/me/forms/#{mine.id}/fields/abcd1234", headers: auth_headers
      expect(response).to(have_http_status(:not_found))
      expect(theirs.reload.fields).to(eq([field]))
    end

    it "requires authentication" do
      post "/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: "x" }, as: :json
      expect(response).to(have_http_status(:unauthorized))
      patch "/api/me/forms/#{form.id}/fields/reorder", params: { ids: [] }, as: :json
      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "apply_template and duplicate" do
    it "applies a template to a form without responses" do
      form = make_form

      post "/api/me/forms/#{form.id}/apply_template", params: { template: "feedback" }, headers: auth_headers, as: :json

      expect(response).to(have_http_status(:ok))
      expect(json["form"]["fields"].size).to(eq(3))
    end

    it "refuses an unknown template and a form with responses" do
      form = make_form
      post "/api/me/forms/#{form.id}/apply_template", params: { template: "community-1" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:unprocessable_entity))

      form.update_column(:responses_count, 2)
      post "/api/me/forms/#{form.id}/apply_template", params: { template: "contact" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:unprocessable_entity))
    end

    it "duplicates a form unpublished, with fresh ids and no responses" do
      original = make_form(title: "Survey", fields: [field], published: true, responses_count: 9)

      post "/api/me/forms/#{original.id}/duplicate", headers: auth_headers

      expect(response).to(have_http_status(:created))
      copy = Form.find(json["form"]["id"])
      expect(copy).to(have_attributes(title: "Copy of Survey", published: false, responses_count: 0, user_id: current_user.id))
      expect(copy.public_id).not_to(eq(original.public_id))
      expect(copy.fields.size).to(eq(1))
      expect(copy.fields.first["id"]).not_to(eq("abcd1234"))
    end

    it "counts a duplicate against the daily quota" do
      original = make_form
      (Form::MAX_CREATED_PER_DAY - 2).times { |i| make_form(title: "F#{i}") }

      post "/api/me/forms/#{original.id}/duplicate", headers: auth_headers
      expect(response).to(have_http_status(:created))
      post "/api/me/forms/#{original.id}/duplicate", headers: auth_headers
      expect(response).to(have_http_status(:too_many_requests))
    end

    it "answers another user's form as not found" do
      theirs = make_form(user: other_user)

      post "/api/me/forms/#{theirs.id}/duplicate", headers: auth_headers
      expect(response).to(have_http_status(:not_found))
      post "/api/me/forms/#{theirs.id}/apply_template", params: { template: "contact" }, headers: auth_headers, as: :json
      expect(response).to(have_http_status(:not_found))
    end
  end
end
