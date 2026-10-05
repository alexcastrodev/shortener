require "rails_helper"

RSpec.describe("the booking question", type: :request) do
  include_context "authenticated user"

  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:service) { { name: "Haircut", duration: 45, price: 25.5, currency: "EUR", capacity: 2, days: ["mon", "tue"], times: ["09:00", "10:00"] } }
  let(:email) { { "id" => "mail0001", "type" => "email", "label" => "Email", "required" => true } }
  let(:name) { { "id" => "name0001", "type" => "short_text", "label" => "Name", "required" => true } }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
  end

  def json
    JSON.parse(response.body)
  end

  def booking_field(body = json)
    body["form"]["fields"].find { |field| field["type"] == "booking" }
  end

  def add_booking(extra = {})
    post("/api/me/forms/#{form.id}/fields", params: { type: "booking", label: "Pick a time" }.merge(extra), headers: auth_headers, as: :json)
  end

  describe "who can add it" do
    it "lets an enabled account add it, with the owner's time zone and automatic approval" do
      current_user.update!(time_zone: "Europe/Lisbon")
      add_booking
      expect(response).to(have_http_status(:created))
      expect(booking_field).to(include("services" => [], "rules" => { "time_zone" => "Europe/Lisbon", "approval" => "auto", "min_notice_minutes" => 0, "window_days" => 60, "buffer_minutes" => 0 }))
    end

    it "refuses it when the feature is off" do
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      add_booking
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]["fields"]).to(include("booking is not available for this account"))
      expect(form.reload.fields).to(eq([]))
    end

    it "refuses it for an account outside the allow-list" do
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ALLOWED_EMAILS").and_return("someone@else.com"))
      add_booking
      expect(response).to(have_http_status(:unprocessable_entity))
    end

    it "lets a listed account add it" do
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ALLOWED_EMAILS").and_return(current_user.email))
      add_booking
      expect(response).to(have_http_status(:created))
    end

    it "keeps an existing booking form editable if the account later loses access" do
      add_booking
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      patch("/api/me/forms/#{form.id}", params: { title: "Renamed" }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:ok))
    end

    it "does not let the type through the MCP field schema" do
      expect(Mcp::Tools::FormToolHelpers::FIELD_PROPERTIES[:type][:enum]).not_to(include("booking"))
    end
  end

  describe "one per form" do
    it "refuses a second booking question" do
      add_booking
      add_booking
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]["fields"]).to(include("only one booking question is allowed"))
      expect(form.reload.fields.count { |field| field["type"] == "booking" }).to(eq(1))
    end
  end

  describe "services" do
    it "stores a service with a generated id and lets the visitor-facing fields through" do
      add_booking({ services: [service] })
      expect(response).to(have_http_status(:created))
      stored = booking_field["services"].first
      expect(stored["id"]).to(match(/\A[A-Za-z0-9]{8}\z/))
      expect(stored).to(include("name" => "Haircut", "duration" => 45, "price" => 25.5, "currency" => "EUR", "capacity" => 2, "days" => ["mon", "tue"], "times" => ["09:00", "10:00"]))
    end

    it "keeps a service id when the service is edited, and gives new ones to new services" do
      add_booking({ services: [service] })
      field = booking_field
      kept = field["services"].first["id"]

      patch("/api/me/forms/#{form.id}/fields/#{field["id"]}", params: { services: [service.merge(id: kept, name: "Cut"), service.merge(name: "Beard")] }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:ok))
      services = booking_field["services"]
      expect(services.map { |item| item["name"] }).to(eq(["Cut", "Beard"]))
      expect(services.first["id"]).to(eq(kept))
      expect(services.last["id"]).not_to(eq(kept))
    end

    it "keeps the other rules when only one rule is edited" do
      add_booking
      field = booking_field
      patch("/api/me/forms/#{form.id}/fields/#{field["id"]}", params: { rules: { time_zone: "America/Sao_Paulo" } }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:ok))
      expect(booking_field["rules"]).to(include("time_zone" => "America/Sao_Paulo", "approval" => "auto", "window_days" => 60))
    end

    {
      "a duration under 5 minutes" => { duration: 4 },
      "a duration over 600 minutes" => { duration: 601 },
      "a price without a currency" => { currency: nil },
      "a negative price" => { price: -1 },
      "a currency that is not 3 letters" => { currency: "euro" },
      "a capacity of zero" => { capacity: 0 },
      "an unknown weekday" => { days: ["funday"] },
      "a repeated weekday" => { days: ["mon", "mon"] },
      "a malformed time" => { times: ["9:00"] },
      "a time past midnight" => { times: ["24:00"] },
      "a repeated time" => { times: ["09:00", "09:00"] },
    }.each do |label, change|
      it "rejects #{label}" do
        add_booking({ services: [service.merge(change)] })
        expect(response).to(have_http_status(:unprocessable_entity))
        expect(form.reload.fields).to(eq([]))
      end
    end

    it "rejects more than 20 services" do
      add_booking({ services: Array.new(21) { |index| service.merge(name: "S#{index}") } })
      expect(response).to(have_http_status(:unprocessable_entity))
    end

    it "rejects a manual approval and an unknown time zone for now" do
      add_booking({ rules: { approval: "manual" } })
      expect(response).to(have_http_status(:unprocessable_entity))
      add_booking({ rules: { time_zone: "Mars/Olympus" } })
      expect(response).to(have_http_status(:unprocessable_entity))
    end

    it "treats an empty capacity as unlimited" do
      add_booking({ services: [service.merge(capacity: nil)] })
      expect(response).to(have_http_status(:created))
      expect(booking_field["services"].first["capacity"]).to(be_nil)
    end
  end

  describe "what visitors see" do
    let(:public_form) do
      Forms::Definition.add(form, JSON.parse({ type: "booking", label: "Pick", services: [service] }.to_json))
      Forms::Definition.add(form, name)
      Forms::Definition.add(form, email)
      form.reload.tap { |f| Forms::Publish.call(form: f) }
    end

    it "lists only the closed set of service keys plus the time zone" do
      get("/api/public/forms/#{public_form.public_id}")
      shown = JSON.parse(response.body)["form"]["fields"].find { |field| field["type"] == "booking" }
      expect(shown.keys).to(match_array(["id", "type", "label", "services", "time_zone"]))
      expect(shown["services"].first.keys).to(match_array(["id", "name", "duration", "price", "currency", "days", "times"]))
      expect(shown["time_zone"]).to(eq("UTC"))
      expect(response.body).not_to(include("approval", "capacity"))
    end
  end

  describe "publishing" do
    def publish
      post("/api/me/forms/#{form.id}/publish", headers: auth_headers)
    end

    def complete_form(booking: { services: [service] }, extra: [name, email])
      add_booking(booking)
      extra.each { |field| Forms::Definition.add(form.reload, field) }
    end

    it "publishes a complete booking form" do
      complete_form
      publish
      expect(response).to(have_http_status(:ok))
      expect(json["form"]["published"]).to(be(true))
    end

    it "is blocked without a service" do
      complete_form(booking: {})
      publish
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]["fields"]).to(include("add at least one service"))
      expect(form.reload.published).to(be(false))
    end

    it "is blocked when a service has no days or no times" do
      complete_form(booking: { services: [service.merge(times: [])] })
      publish
      expect(json["errors"]["fields"]).to(include("Haircut needs at least one day and one time"))

      patch("/api/me/forms/#{form.id}/fields/#{form.reload.fields.find { |field| field["type"] == "booking" }["id"]}", params: { services: [service.merge(days: [])] }, headers: auth_headers, as: :json)
      publish
      expect(json["errors"]["fields"]).to(include("Haircut needs at least one day and one time"))
    end

    it "is blocked without a required email question" do
      complete_form(extra: [name, email.merge("required" => false)])
      publish
      expect(json["errors"]["fields"]).to(include("add a required email question to send the confirmation"))
    end

    it "is blocked without a required short text question for the name" do
      complete_form(extra: [email])
      publish
      expect(json["errors"]["fields"]).to(include("add a required short text question for the name"))
    end

    it "does not block forms without a booking question" do
      Forms::Definition.add(form, name)
      publish
      expect(response).to(have_http_status(:ok))
    end
  end

  it "answers 401 without a token" do
    post("/api/me/forms/#{form.id}/fields", params: { type: "booking", label: "x" }, as: :json)
    expect(response).to(have_http_status(:unauthorized))
  end
end
