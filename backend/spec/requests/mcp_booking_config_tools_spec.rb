require "rails_helper"

RSpec.describe("MCP booking setup tools", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
  let(:scopes) { ["appointments:write"] }
  let(:grant) { OauthGrant.create!(user: user, oauth_client: client, scopes: scopes, resource: "https://api.kurz.fyi/mcp") }
  let(:access) { OauthAccessToken.issue(grant).first }
  let(:accept) { { "Accept" => "application/json, text/event-stream" } }
  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:draft) { Form.create!(user: user, title: "Salon") }
  let(:service) { { "name" => "Haircut", "duration" => 60, "price" => 25, "currency" => "EUR", "capacity" => 2, "days" => ["tue", "wed"], "times" => ["09:00", "10:00"] } }

  around do |example|
    ENV["MCP_ENABLED"] = "true"
    example.run
  ensure
    ENV.delete("MCP_ENABLED")
  end

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    travel_to(now)
  end

  def tool(name, args = {}, token: access)
    post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }, headers: accept.merge("Authorization" => "Bearer #{token}"), as: :json)
    JSON.parse(response.body)
  end

  def data(reply) = reply.dig("result", "structuredContent")

  def failed?(reply) = reply["error"].present? || reply.dig("result", "isError") == true

  def listed
    post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/list" }, headers: accept.merge("Authorization" => "Bearer #{access}"), as: :json)
    JSON.parse(response.body).dig("result", "tools").map { |item| item["name"] }
  end

  def booking_of(form) = form.reload.fields.find { |field| field["type"] == "booking" }

  def service_id(form) = booking_of(form)["services"].first["id"]

  describe "which tools appear" do
    let(:names) { ["update_booking_config", "apply_time_slots", "get_booking_impact"] }

    it "lists the setup tools for appointments:write and only the impact tool for read" do
      expect(listed & names).to(match_array(names))
      grant.update!(scopes: ["appointments:read"])
      expect(listed & names).to(eq(["get_booking_impact"]))
    end

    it "does not list any tool that publishes, approves or cancels" do
      expect(listed.grep(/publish_booking|approve|decline|cancel|reschedule/)).to(be_empty)
    end
  end

  describe "update_booking_config" do
    it "creates the booking question of a draft with the services, giving them ids" do
      reply = data(tool("update_booking_config", { form_id: draft.id, services: [service], rules: { approval: "manual" } }))
      expect(reply["services"].first).to(include("name" => "Haircut", "duration" => 60, "capacity" => 2))
      expect(reply["services"].first["id"]).to(match(/\A[A-Za-z0-9]{8}\z/))
      expect(reply["rules"]).to(include("approval" => "manual", "time_zone" => "UTC", "approval_timeout_minutes" => 1440))
      expect(booking_of(draft)["services"].size).to(eq(1))
      expect(draft.reload.published).to(be(false))
    end

    it "keeps a service when its id is sent and merges rules" do
      data(tool("update_booking_config", { form_id: draft.id, services: [service], rules: { window_days: 30 } }))
      sid = service_id(draft)
      reply = data(tool("update_booking_config", { form_id: draft.id, services: [service.merge("id" => sid, "name" => "Cut")], rules: { buffer_minutes: 15 } }))
      expect(reply["services"].first).to(include("id" => sid, "name" => "Cut"))
      expect(reply["rules"]).to(include("window_days" => 30, "buffer_minutes" => 15))
    end

    it "sets days off without echoing the private notes back" do
      data(tool("update_booking_config", { form_id: draft.id, services: [service] }))
      reply = data(tool("update_booking_config", { form_id: draft.id, exceptions: [{ from: "2026-12-25", kind: "closed", note: "private" }] }))
      expect(reply["exceptions"].first).to(include("from" => "2026-12-25", "kind" => "closed"))
      expect(reply.to_json).not_to(include("private"))
      expect(booking_of(draft)["exceptions"].first["note"]).to(eq("private"))
    end

    it "refuses a published form and leaves it untouched" do
      data(tool("update_booking_config", { form_id: draft.id, services: [service] }))
      Forms::Definition.add(draft.reload, { "type" => "short_text", "label" => "Name", "required" => true })
      Forms::Definition.add(draft.reload, { "type" => "email", "label" => "Email", "required" => true })
      Forms::Publish.call(form: draft.reload)
      before = booking_of(draft)
      expect(data(tool("update_booking_config", { form_id: draft.id, services: [service.merge("name" => "Hacked")] }))["error"]).to(eq("form_published"))
      expect(booking_of(draft)).to(eq(before))
    end

    it "reports invalid input without saving anything" do
      expect(data(tool("update_booking_config", { form_id: draft.id, services: [service.except("price")] }))["error"]).to(eq("invalid_input"))
      expect(booking_of(draft)).to(be_nil)
      expect(failed?(tool("update_booking_config", { form_id: draft.id, services: [service.merge("duration" => 4)] }))).to(be(true))
      expect(failed?(tool("update_booking_config", { form_id: draft.id, services: [service.merge("days" => ["funday"])] }))).to(be(true))
      expect(failed?(tool("update_booking_config", { form_id: draft.id, user_id: other.id }))).to(be(true))
    end

    it "answers not found for someone else's form" do
      theirs = Form.create!(user: other, title: "Theirs")
      expect(data(tool("update_booking_config", { form_id: theirs.id, services: [service] }))["error"]).to(eq("not_found"))
      expect(booking_of(theirs)).to(be_nil)
    end
  end

  describe "apply_time_slots" do
    before { data(tool("update_booking_config", { form_id: draft.id, services: [service] })) }

    it "sets the usual times from working hours, using the service's duration" do
      reply = data(tool("apply_time_slots", { form_id: draft.id, service_id: service_id(draft), from: "09:00", to: "13:00", step: 60, lunch: { from: "11:00", to: "12:00" } }))
      expect(reply["times"]).to(eq(["09:00", "10:00", "12:00"]))
      expect(booking_of(draft)["services"].first["times"]).to(eq(["09:00", "10:00", "12:00"]))
    end

    it "refuses bad hours and an unknown service, changing nothing" do
      reply = data(tool("apply_time_slots", { form_id: draft.id, service_id: service_id(draft), from: "18:00", to: "09:00", step: 60 }))
      expect(reply["error"]).to(eq("invalid_input"))
      expect(data(tool("apply_time_slots", { form_id: draft.id, service_id: "nope0000", from: "09:00", to: "13:00", step: 60 }))["error"]).to(eq("not_found"))
      expect(booking_of(draft)["services"].first["times"]).to(eq(["09:00", "10:00"]))
    end

    it "refuses a published form and someone else's" do
      theirs = Form.create!(user: other, title: "Theirs")
      expect(data(tool("apply_time_slots", { form_id: theirs.id, service_id: "abcdefgh", from: "09:00", to: "13:00", step: 60 }))["error"]).to(eq("not_found"))
    end
  end

  describe "get_booking_impact" do
    let(:scopes) { ["appointments:read", "appointments:write"] }

    def book(form, at, key)
      slot = AppointmentSlot.create!(form: form, service_key: key, starts_at: at, capacity: 2, booked: 1)
      Appointment.create!(form: form, response: FormResponse.create!(form: form, answers: {}), slot: slot, group_key: SecureRandom.uuid, status: "confirmed", client_name: "Ana Private", snapshot: { "name" => "Haircut" })
    end

    before { data(tool("update_booking_config", { form_id: draft.id, services: [service] })) }

    it "counts the bookings ahead the draft would leave out, with ids only" do
      sid = service_id(draft)
      keep = book(draft, Time.utc(2026, 11, 3, 9), sid)
      moved = book(draft, Time.utc(2026, 11, 3, 10), sid)
      gone = book(draft, Time.utc(2026, 11, 4, 9), "oldservc")
      past = book(draft, Time.utc(2026, 10, 27, 9), sid)
      data(tool("apply_time_slots", { form_id: draft.id, service_id: sid, from: "09:00", to: "10:00", step: 60 }))

      reply = data(tool("get_booking_impact", { form_id: draft.id }))
      expect(reply).to(include("upcoming" => 3, "affected" => 2))
      expect(reply["appointments"].map { |item| [item["id"], item["reason"]] }).to(eq([[moved.id, "time_no_longer_offered"], [gone.id, "service_removed"]]))
      expect(reply.to_json).not_to(include("Ana Private"))
      expect([keep.id, past.id]).not_to(include(*reply["appointments"].map { |item| item["id"] }))
    end

    it "sees a day closed by an exception" do
      sid = service_id(draft)
      booked = book(draft, Time.utc(2026, 11, 3, 9), sid)
      data(tool("update_booking_config", { form_id: draft.id, exceptions: [{ from: "2026-11-03", kind: "closed" }] }))
      expect(data(tool("get_booking_impact", { form_id: draft.id }))["appointments"].map { |item| item["id"] }).to(eq([booked.id]))
    end

    it "reports nothing for a setup that still fits, and answers no_booking or not_found otherwise" do
      book(draft, Time.utc(2026, 11, 3, 9), service_id(draft))
      expect(data(tool("get_booking_impact", { form_id: draft.id }))).to(include("upcoming" => 1, "affected" => 0, "appointments" => []))
      plain = Form.create!(user: user, title: "Plain")
      expect(data(tool("get_booking_impact", { form_id: plain.id }))["error"]).to(eq("no_booking"))
      expect(data(tool("get_booking_impact", { form_id: Form.create!(user: other, title: "T").id }))["error"]).to(eq("not_found"))
    end
  end
end
