require "rails_helper"

RSpec.describe("MCP form tools", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
  let(:scopes) { ["forms:read", "forms:write"] }
  let(:grant) { OauthGrant.create!(user: user, oauth_client: client, scopes: scopes, resource: "https://api.kurz.fyi/mcp") }
  let(:access) { OauthAccessToken.issue(grant).first }
  let(:accept) { { "Accept" => "application/json, text/event-stream" } }

  around do |example|
    ENV["MCP_ENABLED"] = "true"
    example.run
  ensure
    ENV.delete("MCP_ENABLED")
  end

  before do
    host! "localhost"
  end

  def tool(name, args = {}, token: access)
    post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json)
    JSON.parse(response.body)
  end

  def data(reply)
    reply.dig("result", "structuredContent")
  end

  def failed?(reply)
    reply["error"].present? || reply.dig("result", "isError") == true
  end

  def snapshot(form)
    form.reload.attributes
  end

  describe "creating" do
    it "creates an unpublished empty form with a dashboard link" do
      reply = tool("create_form", { title: "Survey", theme: "ocean" })

      expect(failed?(reply)).to(be(false))
      expect(data(reply)).to(include("title" => "Survey", "published" => false, "questions" => 0, "responses_count" => 0))
      expect(data(reply)["dashboard_url"]).to(end_with("/app/forms/#{data(reply)["id"]}"))
      expect(data(reply)["note"]).to(include("dashboard"))
      expect(Form.find(data(reply)["id"]).published).to(be(false))
    end

    it "refuses published, public_id, fields, user_id and every undeclared key" do
      [{ published: true }, { public_id: "AAAAAAAAAAAA" }, { fields: [] }, { user_id: other.id }, { responses_count: 9 }].each do |extra|
        expect(failed?(tool("create_form", { title: "x" }.merge(extra)))).to(be(true), extra.keys.inspect)
      end
      expect(Form.count).to(eq(0))
    end

    it "creates from a built-in template as a draft and refuses unknown ones" do
      reply = tool("create_form_from_template", { template: "contact", title: "My contact" })

      expect(data(reply)).to(include("title" => "My contact", "published" => false, "questions" => 3))
      ["community-1", "nope", "../etc"].each { |id| expect(failed?(tool("create_form_from_template", { template: id }))).to(be(true), id) }
      expect(Form.count).to(eq(1))
    end

    it "shares the 20 a day quota between both tools, per user" do
      10.times { tool("create_form", { title: "a" }) }
      10.times { tool("create_form_from_template", { template: "waitlist" }) }
      expect(user.forms.count).to(eq(20))

      expect(data(tool("create_form", { title: "21st" }))).to(include("error" => "forms_daily_limit"))
      expect(data(tool("create_form_from_template", { template: "contact" }))).to(include("error" => "forms_daily_limit"))
      expect(user.forms.count).to(eq(20))

      theirs = OauthAccessToken.issue(OauthGrant.create!(user: other, oauth_client: client, scopes: scopes, resource: "https://api.kurz.fyi/mcp")).first
      expect(failed?(tool("create_form", { title: "free" }, token: theirs))).to(be(false))
    end
  end

  describe "editing drafts" do
    let!(:draft) { Form.create!(user: user, title: "Draft") }
    let(:text_field) { { type: "short_text", label: "Name", required: true } }

    it "builds a form: questions of every kind, edit, reorder, remove" do
      added = [
        text_field,
        { type: "single_choice", label: "Pick", choices: [{ label: "A" }, { label: "B" }] },
        { type: "multiple_choice", label: "Many", choices: [{ label: "X" }, { label: "Y" }, { label: "Z" }], max_choices: 2 },
        { type: "rating", label: "Rate", scale: 10 },
        { type: "number", label: "Num", min: 1, max: 9 },
        { type: "yes_no", label: "YN" },
        { type: "date", label: "When" },
        { type: "email", label: "Mail" },
        { type: "long_text", label: "Long", help: "More" },
      ].map { |f| data(tool("add_field", { form_id: draft.id }.merge(f))) }

      fields = added.last["fields"]
      expect(fields.map { |f| f["type"] }).to(eq(["short_text", "single_choice", "multiple_choice", "rating", "number", "yes_no", "date", "email", "long_text"]))
      expect(fields[1]["choices"].map { |c| c["id"] }).to(all(match(/\A[A-Za-z0-9]{8}\z/)))

      first_id = fields.first["id"]
      renamed = data(tool("update_field", { form_id: draft.id, field_id: first_id, label: "Full name" }))
      expect(renamed["fields"].first).to(include("label" => "Full name", "required" => true))

      ids = renamed["fields"].map { |f| f["id"] }.reverse
      expect(data(tool("reorder_fields", { form_id: draft.id, ids: ids }))["fields"].map { |f| f["id"] }).to(eq(ids))
      expect(data(tool("remove_field", { form_id: draft.id, field_id: ids.first }))["questions"]).to(eq(8))
      expect(data(tool("update_form", { id: draft.id, title: "Renamed", thank_you_message: "Thanks" }))).to(include("title" => "Renamed", "thank_you_message" => "Thanks", "published" => false))
    end

    it "refuses invalid questions without changing the form" do
      before = snapshot(draft)
      [
        { type: "rating", label: "x", scale: 7 },
        { type: "single_choice", label: "x", choices: [{ label: "only" }] },
        { type: "file", label: "x" },
        { type: "short_text", label: "" },
        { type: "short_text", label: "a" * 301 },
        { type: "number", label: "x", min: 9, max: 1 },
        { type: "multiple_choice", label: "x", choices: [{ label: "a" }, { label: "b" }], max_choices: 5 },
        { type: "short_text", label: "x", id: "hacked00" },
        { type: "short_text", label: "x", evil: 1 },
      ].each do |bad|
        expect(failed?(tool("add_field", { form_id: draft.id }.merge(bad)))).to(be(true), bad.inspect)
      end
      expect(snapshot(draft)).to(eq(before))
    end

    it "does not change the type of a question and refuses a reorder that is not a permutation" do
      field_id = data(tool("add_field", { form_id: draft.id }.merge(text_field)))["fields"].first["id"]
      before = snapshot(draft)

      expect(failed?(tool("update_field", { form_id: draft.id, field_id: field_id, type: "email" }))).to(be(true))
      [[], [field_id, field_id], [field_id, "zzzzzzzz"], ["zzzzzzzz"]].each do |ids|
        expect(failed?(tool("reorder_fields", { form_id: draft.id, ids: ids }))).to(be(true), ids.inspect)
      end
      expect(snapshot(draft)).to(eq(before))
    end

    it "keeps markup in text inert" do
      reply = tool("add_field", { form_id: draft.id, type: "short_text", label: "<img src=x onerror=alert(1)>" })

      expect(data(reply)["fields"].first["label"]).to(eq("<img src=x onerror=alert(1)>"))
    end
  end

  describe "published forms and forms with responses" do
    let!(:live) { Form.create!(user: user, title: "Live", published: true, fields: [{ "id" => "abcd1234", "type" => "short_text", "label" => "Q" }]) }
    let!(:answered) { Form.create!(user: user, title: "Answered", fields: [{ "id" => "wxyz5678", "type" => "short_text", "label" => "Q" }]) }

    before do
      FormResponse.create!(form: answered, answers: { "wxyz5678" => "CNRY-respondent" })
    end

    it "changes nothing on a published form, whichever write tool is used" do
      before = snapshot(live)

      [
        ["update_form", { id: live.id, title: "hacked" }],
        ["add_field", { form_id: live.id, type: "yes_no", label: "x" }],
        ["update_field", { form_id: live.id, field_id: "abcd1234", label: "x" }],
        ["remove_field", { form_id: live.id, field_id: "abcd1234" }],
        ["reorder_fields", { form_id: live.id, ids: ["abcd1234"] }],
      ].each do |name, args|
        expect(data(tool(name, args))).to(include("error" => "form_published"), name)
      end

      expect(snapshot(live)).to(eq(before))
    end

    it "lets a draft with responses keep its questions but change its texts" do
      before = snapshot(answered)

      [
        ["add_field", { form_id: answered.id, type: "yes_no", label: "x" }],
        ["update_field", { form_id: answered.id, field_id: "wxyz5678", label: "x" }],
        ["remove_field", { form_id: answered.id, field_id: "wxyz5678" }],
        ["reorder_fields", { form_id: answered.id, ids: ["wxyz5678"] }],
      ].each do |name, args|
        expect(data(tool(name, args))).to(include("error" => "form_has_responses"), name)
      end
      expect(snapshot(answered)).to(eq(before))
      expect(data(tool("update_form", { id: answered.id, title: "Still editable" }))).to(include("title" => "Still editable"))
    end

    it "has no tool that publishes, deletes, duplicates or reads responses with only forms scopes" do
      names = Mcp::Tools.for_scopes(scopes).map(&:tool_name)

      expect(names.grep(/publish|delete|destroy|duplicate|response/)).to(be_empty)
    end
  end

  describe "reading" do
    let!(:form) { Form.create!(user: user, title: "Mine", fields: [{ "id" => "abcd1234", "type" => "short_text", "label" => "Q" }]) }

    it "lists and shows forms without any response data" do
      FormResponse.create!(form: form, answers: { "abcd1234" => "CNRY-secret-answer" }, country: "PT")
      Form.create!(user: other, title: "Not mine")

      listed = tool("list_forms")
      shown = tool("get_form", { id: form.id })

      expect(data(listed)["forms"].map { |f| f["title"] }).to(eq(["Mine"]))
      expect(data(shown)).to(include("responses_count" => 1))
      expect(data(shown)["fields"].first.keys).to(match_array(["id", "type", "label"]))
      expect([listed, shown].to_json).not_to(include("CNRY"))
    end

    it "lists the built-in templates" do
      ids = data(tool("list_form_templates"))["templates"].map { |t| t["id"] }

      expect(ids).to(match_array(BuiltInFormTemplates.all.map { |t| t["id"] }))
    end

    it "answers another user's form exactly like a missing one, for every tool that takes an id" do
      theirs = Form.create!(user: other, title: "Theirs", fields: [{ "id" => "zzzz0001", "type" => "short_text", "label" => "Q" }])
      before = snapshot(theirs)

      [
        ["get_form", { id: theirs.id }, { id: 999_999 }],
        ["update_form", { id: theirs.id, title: "x" }, { id: 999_999, title: "x" }],
        ["add_field", { form_id: theirs.id, type: "yes_no", label: "x" }, { form_id: 999_999, type: "yes_no", label: "x" }],
        ["remove_field", { form_id: theirs.id, field_id: "zzzz0001" }, { form_id: 999_999, field_id: "zzzz0001" }],
      ].each do |name, foreign, missing|
        expect(data(tool(name, foreign))).to(eq(data(tool(name, missing))), name)
      end
      expect(snapshot(theirs)).to(eq(before))
    end
  end

  describe "scopes" do
    it "shows read tools to forms:read and the write tools only with forms:write" do
      names = ->(token) { post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/list" }, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json) && JSON.parse(response.body).dig("result", "tools").map { |t| t["name"] } }

      grant.update!(scopes: ["forms:read"])
      expect(names.call(access)).to(match_array(["list_forms", "get_form", "list_form_templates"]))
      grant.update!(scopes: ["forms:write"])
      expect(names.call(access)).to(include("create_form", "add_field", "list_forms"))
    end
  end
end
