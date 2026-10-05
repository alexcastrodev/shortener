require "rails_helper"

RSpec.describe("/api/me/forms/:id/responses and summary", type: :request) do
  include_context "authenticated user"

  let(:other) { FactoryBot.create(:user) }
  let(:choices) { [{ "id" => "aaaaaaa1", "label" => "Red" }, { "id" => "bbbbbbb2", "label" => "Blue" }] }
  let(:fields) do
    [
      { "id" => "name0001", "type" => "short_text", "label" => "Name" },
      { "id" => "pick0001", "type" => "single_choice", "label" => "Color", "choices" => choices },
      { "id" => "many0001", "type" => "multiple_choice", "label" => "Many", "choices" => choices },
      { "id" => "rate0001", "type" => "rating", "label" => "Rate", "scale" => 5 },
      { "id" => "num00001", "type" => "number", "label" => "Num" },
      { "id" => "yn000001", "type" => "yes_no", "label" => "YN" },
    ]
  end
  let!(:form) { Form.create!(user: current_user, title: "Mine", fields: fields, published: true) }
  def json
    JSON.parse(response.body)
  end

  before do
    host! "localhost"
  end

  def respond(answers, **meta)
    FormResponse.create!({ form: form, answers: answers }.merge(meta))
  end

  it "requires authentication" do
    get "/api/me/forms/#{form.id}/responses"
    expect(response).to(have_http_status(:unauthorized))
    get "/api/me/forms/#{form.id}/summary"
    expect(response).to(have_http_status(:unauthorized))
  end

  describe "index" do
    it "lists newest first with answers resolved to labels, and pages by cursor" do
      3.times { |i| respond({ "name0001" => "n#{i}", "pick0001" => "aaaaaaa1", "many0001" => ["aaaaaaa1", "bbbbbbb2"] }, country: "PT", platform: "iOS", browser: "Safari", source: "Direct") }

      get "/api/me/forms/#{form.id}/responses", params: { limit: 2 }, headers: auth_headers

      expect(response).to(have_http_status(:ok))
      rows = json["response"]
      expect(rows.size).to(eq(2))
      first = rows.first
      expect(first.keys).to(match_array(["id", "country", "platform", "browser", "source", "submitted_at", "answers"]))
      expect(first["answers"].find { |a| a["id"] == "pick0001" }["value"]).to(eq("Red"))
      expect(first["answers"].find { |a| a["id"] == "many0001" }["value"]).to(eq(["Red", "Blue"]))
      expect(json["next_before"]).to(eq(rows.last["id"]))

      get "/api/me/forms/#{form.id}/responses", params: { limit: 2, before: json["next_before"] }, headers: auth_headers
      expect(json["response"].size).to(eq(1))
      expect(json["next_before"]).to(be_nil)
    end

    it "never lists another form's responses and caps the page at 50" do
      theirs = Form.create!(user: other, title: "T", fields: fields)
      FormResponse.create!(form: theirs, answers: {})
      respond({ "name0001" => "mine" })

      get "/api/me/forms/#{form.id}/responses", params: { limit: 9999 }, headers: auth_headers

      expect(json["response"].size).to(eq(1))
    end

    it "limits the list to the requested period and ignores unknown ones" do
      recent = respond({ "name0001" => "recent" })
      old = respond({ "name0001" => "old" })
      old.update_columns(created_at: 40.days.ago)

      get "/api/me/forms/#{form.id}/responses", params: { days: 30 }, headers: auth_headers
      expect(json["response"].map { |row| row["id"] }).to(eq([recent.id]))

      get "/api/me/forms/#{form.id}/responses", params: { days: 90 }, headers: auth_headers
      expect(json["response"].size).to(eq(2))

      get "/api/me/forms/#{form.id}/responses", params: { days: 5 }, headers: auth_headers
      expect(json["response"].size).to(eq(2))
    end

    it "drops answers whose question was removed" do
      respond({ "name0001" => "keep", "gone0000" => "old" })

      get "/api/me/forms/#{form.id}/responses", headers: auth_headers

      expect(json["response"].first["answers"].map { |a| a["id"] }).to(eq(["name0001"]))
    end
  end

  describe "show and delete" do
    it "shows, deletes one and updates the counter" do
      keep = respond({ "name0001" => "a" })
      gone = respond({ "name0001" => "b" })

      get "/api/me/forms/#{form.id}/responses/#{gone.id}", headers: auth_headers
      expect(response).to(have_http_status(:ok))

      delete "/api/me/forms/#{form.id}/responses/#{gone.id}", headers: auth_headers
      expect(response).to(have_http_status(:no_content))
      expect(form.reload.responses_count).to(eq(1))
      expect(FormResponse.exists?(keep.id)).to(be(true))
    end

    it "deletes every response and resets the counter" do
      2.times { respond({ "name0001" => "a" }) }

      delete "/api/me/forms/#{form.id}/responses", headers: auth_headers

      expect(response).to(have_http_status(:no_content))
      expect(form.reload.responses_count).to(eq(0))
      expect(FormResponse.where(form_id: form.id).count).to(eq(0))
    end
  end

  describe "tenant isolation" do
    it "answers another user's form and a response of another form like missing ones" do
      theirs = Form.create!(user: other, title: "T", fields: fields)
      foreign = FormResponse.create!(form: theirs, answers: {})
      mine = respond({ "name0001" => "a" })

      [[:get, "/api/me/forms/#{theirs.id}/responses"], [:get, "/api/me/forms/#{theirs.id}/summary"], [:delete, "/api/me/forms/#{theirs.id}/responses"], [:get, "/api/me/forms/#{form.id}/responses/#{foreign.id}"], [:delete, "/api/me/forms/#{form.id}/responses/#{foreign.id}"], [:get, "/api/me/forms/0/responses"]].each do |verb, path|
        send(verb, path, headers: auth_headers)
        expect(response).to(have_http_status(:not_found), "#{verb} #{path}")
      end
      expect(FormResponse.exists?(foreign.id)).to(be(true))
      expect(FormResponse.exists?(mine.id)).to(be(true))
    end
  end

  describe "summary" do
    before do
      FormDailyStat.create!(form: form, day: Date.current, views: 10, unique_views: 8, starts: 5)
      respond({ "name0001" => "Ana", "pick0001" => "aaaaaaa1", "many0001" => ["aaaaaaa1"], "rate0001" => 4, "num00001" => 10, "yn000001" => true }, country: "PT", platform: "iOS", browser: "Safari", source: "Direct")
      respond({ "name0001" => "Bo", "pick0001" => "bbbbbbb2", "rate0001" => 2, "num00001" => 20, "yn000001" => false }, country: "PT", platform: "Android", browser: "Chrome", source: "Instagram")
      respond({ "pick0001" => "zzzzzzz9" })
    end

    it "builds the funnel, timeline, audience and per-question numbers" do
      get "/api/me/forms/#{form.id}/summary", headers: auth_headers

      expect(response).to(have_http_status(:ok))
      expect(json["funnel"]).to(eq("views" => 10, "unique_views" => 8, "starts" => 5, "completions" => 3, "completion_rate" => 0.3))
      expect(json["timeline"].last).to(eq("date" => Date.current.iso8601, "views" => 10, "responses" => 3))
      expect(json["audience"]["countries"].first).to(eq("name" => "PT", "count" => 2))
      by_id = json["fields"].index_by { |f| f["id"] }
      expect(by_id["name0001"]["answered"]).to(eq(2))
      expect(by_id["name0001"]["samples"]).to(eq(["Bo", "Ana"]))
      expect(by_id["num00001"]).to(include("min" => 10, "max" => 20, "average" => 15.0))
      expect(by_id["yn000001"]).to(include("yes" => 1, "no" => 1))
      expect(by_id["rate0001"]["average"]).to(eq(3.0))
      expect(by_id["rate0001"]["distribution"].map { |d| d["count"] }).to(eq([0, 1, 0, 1, 0]))
      counts = by_id["pick0001"]["choices"].to_h { |c| [c["label"], c["count"]] }
      expect(counts).to(eq("Red" => 1, "Blue" => 1, "removed" => 1))
    end

    it "keeps choices with zero answers and accepts the periods" do
      get "/api/me/forms/#{form.id}/summary", params: { days: "all" }, headers: auth_headers
      expect(json["period_days"]).to(eq("all"))
      expect(json["fields"].find { |f| f["id"] == "many0001" }["choices"].map { |c| c["count"] }).to(eq([1, 0]))

      get "/api/me/forms/#{form.id}/summary", params: { days: "7" }, headers: auth_headers
      expect(json["period_days"]).to(eq(7))
      get "/api/me/forms/#{form.id}/summary", params: { days: "5000" }, headers: auth_headers
      expect(json["period_days"]).to(eq(30))
    end

    it "can leave free text out" do
      summary = Forms::Summary.call(form: form, text_samples: false)

      expect(summary[:fields].find { |f| f[:id] == "name0001" }).not_to(have_key(:samples))
    end
  end
end
