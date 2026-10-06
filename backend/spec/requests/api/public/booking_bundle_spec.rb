require "rails_helper"

RSpec.describe("take X, pay Y", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:bundle) { { "take" => 5, "pay" => 4 } }
  let(:service) { { "name" => "Class", "duration" => 60, "price" => 12.5, "currency" => "EUR", "capacity" => nil, "days" => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], "times" => ["09:00"], "bundle" => bundle } }
  let(:form) { Form.create!(user: current_user, title: "Studio") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
  let(:deliveries) { ActionMailer::Base.deliveries }

  around do |example|
    previous = ENV["GMAIL_USERNAME"]
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    example.run
  ensure
    ENV["GMAIL_USERNAME"] = previous
  end

  before do
    host! "localhost"
    deliveries.clear
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    travel_to(now)
  end

  def json = JSON.parse(response.body)

  def build_form(svc = service)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [svc] })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def book(count, ip: "198.51.100.#{rand(1..250)}")
    sessions = (1..count).map { |index| { "date" => (Date.new(2026, 11, 2) + index).iso8601, "time" => "09:00" } }
    answers = { name_id => "Ana", mail_id => "ana@example.com", booking_id => { "service" => service_id, "sessions" => sessions } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", client_locale: "en" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  describe "the price of a booking" do
    before { build_form }

    {
      1 => [12.5, 0],
      4 => [50.0, 0],
      5 => [50.0, 1],
      7 => [75.0, 1],
      10 => [100.0, 2],
      11 => [112.5, 2],
    }.each do |count, (total, free)|
      it "charges #{total} with #{free} free for #{count} sessions" do
        book(count)
        expect(response).to(have_http_status(:created))
        expect(json["price"]).to(eq("total" => total, "currency" => "EUR", "free_sessions" => free))
      end
    end

    it "stores the total and the free sessions with every session of the booking" do
      book(10)
      expect(Appointment.pluck(:snapshot).map { |item| item.slice("total", "free_sessions", "sessions") }.uniq).to(eq([{ "total" => 100.0, "free_sessions" => 2, "sessions" => 10 }]))
    end

    it "tells the client the total and the free sessions in the confirmation email" do
      perform_enqueued_jobs { book(10) }
      client = deliveries.find { |mail| mail.to == ["ana@example.com"] }
      expect(client.text_part.body.to_s).to(include("Total: 100.00 EUR", "2 of the sessions are free."))
    end

    it "leaves out the free line when nothing is free" do
      perform_enqueued_jobs { book(2) }
      client = deliveries.find { |mail| mail.to == ["ana@example.com"] }
      expect(client.text_part.body.to_s).to(include("Total: 25.00 EUR"))
      expect(client.text_part.body.to_s).not_to(include("free"))
    end

    it "shows the offer on the public form" do
      get("/api/public/forms/#{form.public_id}")
      shown = json["form"]["fields"].find { |field| field["type"] == "booking" }["services"].first
      expect(shown).to(include("price" => 12.5, "currency" => "EUR", "bundle" => bundle))
    end
  end

  describe "without an offer or without a price" do
    it "charges the plain price for every session when there is no bundle" do
      build_form(service.except("bundle"))
      book(5)
      expect(json["price"]).to(eq("total" => 62.5, "currency" => "EUR", "free_sessions" => 0))
    end

    it "shows no price when the service has none" do
      build_form(service.except("bundle", "price", "currency"))
      book(3)
      expect(response).to(have_http_status(:created))
      expect(json).not_to(have_key("price"))
      expect(Appointment.first.snapshot).not_to(have_key("total"))
    end
  end

  describe "the owner's setup" do
    def add(svc)
      post("/api/me/forms/#{form.id}/fields", params: { type: "booking", label: "When", services: [svc] }, headers: auth_headers, as: :json)
    end

    it "accepts a valid bundle" do
      add(service)
      expect(response).to(have_http_status(:created))
      expect(json["form"]["fields"].first["services"].first["bundle"]).to(eq(bundle))
    end

    {
      "take of 1" => { "take" => 1, "pay" => 1 },
      "pay equal to take" => { "take" => 5, "pay" => 5 },
      "pay above take" => { "take" => 5, "pay" => 6 },
      "pay of zero" => { "take" => 5, "pay" => 0 },
      "take over 31" => { "take" => 32, "pay" => 4 },
    }.each do |label, invalid|
      it "rejects #{label}" do
        add(service.merge("bundle" => invalid))
        expect(response).to(have_http_status(:unprocessable_content))
      end
    end

    it "rejects a bundle on a service without a price" do
      add(service.except("price", "currency"))
      expect(response).to(have_http_status(:unprocessable_content))
    end
  end

  describe "the MCP" do
    let(:client) { OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]) }
    let(:grant) { OauthGrant.create!(user: current_user, oauth_client: client, scopes: ["appointments:read"], resource: "https://api.kurz.fyi/mcp") }
    let(:access) { OauthAccessToken.issue(grant).first }

    around do |example|
      ENV["MCP_ENABLED"] = "true"
      example.run
    ensure
      ENV.delete("MCP_ENABLED")
    end

    it "gives the same total through get_appointment" do
      build_form
      book(10)
      post("/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_appointment", arguments: { id: Appointment.first.id } } }, headers: { "Accept" => "application/json, text/event-stream", "Authorization" => "Bearer #{access}" }, as: :json)
      expect(json.dig("result", "structuredContent", "appointment", "price")).to(eq("total" => 100.0, "currency" => "EUR", "free_sessions" => 2))
    end
  end
end
