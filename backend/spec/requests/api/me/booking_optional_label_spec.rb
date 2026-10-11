require "rails_helper"

RSpec.describe("the label of the booking question", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:service) { { name: "Haircut", duration: 60, capacity: 1, days: ["mon", "tue", "wed"], times: ["09:00", "10:00"] } }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(Turnstile).to(receive(:check).and_return(:ok))
    travel_to(now)
  end

  def json
    JSON.parse(response.body)
  end

  def booking_field(body = json)
    body["form"]["fields"].find { |field| field["type"] == "booking" }
  end

  def stored_booking
    form.reload.fields.find { |field| field["type"] == "booking" }
  end

  def add_booking(extra = {})
    post("/api/me/forms/#{form.id}/fields", params: { type: "booking", services: [service] }.merge(extra), headers: auth_headers, as: :json)
  end

  def patch_field(id, params)
    patch("/api/me/forms/#{form.id}/fields/#{id}", params: params, headers: auth_headers, as: :json)
  end

  describe "creating the question" do
    it "accepts a question without a label and stores no label key" do
      add_booking

      expect(response).to(have_http_status(:created))
      expect(stored_booking).not_to(have_key("label"))
      expect(booking_field).not_to(have_key("label"))
      expect(booking_field["services"].size).to(eq(1))
    end

    it "treats an empty, blank or null label as no label" do
      [{ label: "" }, { label: "   " }, { label: nil }].each do |attributes|
        form.update!(fields: [])
        add_booking(attributes)

        expect(response).to(have_http_status(:created), attributes.inspect)
        expect(stored_booking).not_to(have_key("label"))
      end
    end

    it "keeps a label when the owner types one, trimmed of nothing else" do
      add_booking(label: "When would you like to come?")

      expect(response).to(have_http_status(:created))
      expect(stored_booking["label"]).to(eq("When would you like to come?"))
    end

    it "still refuses a label that is too long" do
      add_booking(label: "a" * 301)

      expect(response).to(have_http_status(:unprocessable_content))
      expect(form.reload.fields).to(eq([]))
    end
  end

  describe "updating the question" do
    before { add_booking(label: "Pick a time") }

    it "clears a stored label with null or with an empty string" do
      [nil, "", "   "].each do |cleared|
        patch_field(stored_booking["id"], { label: "Pick a time" })
        expect(stored_booking["label"]).to(eq("Pick a time"))

        patch_field(stored_booking["id"], { label: cleared })

        expect(response).to(have_http_status(:ok), cleared.inspect)
        expect(stored_booking).not_to(have_key("label"))
        expect(booking_field).not_to(have_key("label"))
      end
    end

    it "keeps the label when an update does not mention it" do
      patch_field(stored_booking["id"], { help: "Choose a service first" })

      expect(response).to(have_http_status(:ok))
      expect(stored_booking).to(include("label" => "Pick a time", "help" => "Choose a service first"))
    end

    it "gives a label back to a question that had none" do
      patch_field(stored_booking["id"], { label: nil })
      patch_field(stored_booking["id"], { label: "Book here" })

      expect(response).to(have_http_status(:ok))
      expect(stored_booking["label"]).to(eq("Book here"))
    end

    it "keeps updating the rest of an unlabelled question" do
      patch_field(stored_booking["id"], { label: nil })
      patch_field(stored_booking["id"], { rules: { buffer_minutes: 15 } })

      expect(response).to(have_http_status(:ok))
      expect(stored_booking).not_to(have_key("label"))
      expect(stored_booking["rules"]).to(include("buffer_minutes" => 15))
    end
  end

  describe "every other type" do
    it "still needs a label to be created" do
      [nil, "", "  "].each do |label|
        post("/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: label }, headers: auth_headers, as: :json)
        expect(response).to(have_http_status(:unprocessable_content), label.inspect)
      end
      post("/api/me/forms/#{form.id}/fields", params: { type: "short_text" }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:unprocessable_content))
      post("/api/me/forms/#{form.id}/fields", params: { type: "section", label: "" }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:unprocessable_content))
      expect(form.reload.fields).to(eq([]))
    end

    it "cannot lose its label on update" do
      post("/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: "Name" }, headers: auth_headers, as: :json)
      id = form.reload.fields.first["id"]

      [nil, "", "  "].each do |label|
        patch_field(id, { label: label })
        expect(response).to(have_http_status(:unprocessable_content), label.inspect)
        expect(form.reload.fields.first["label"]).to(eq("Name"))
      end
    end
  end

  describe "what visitors and the owner read from a published form" do
    let(:booking_id) { stored_booking["id"] }
    let(:service_id) { stored_booking["services"].first["id"] }
    let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }

    before do
      add_booking
      post("/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: "Name", required: true }, headers: auth_headers, as: :json)
      post("/api/me/forms/#{form.id}/publish", headers: auth_headers)
    end

    def book(date: "2026-11-03", time: "09:00")
      post("/api/public/forms/#{form.public_id}/responses", params: { answers: { name_id => "Ana", booking_id => { "service" => service_id, "sessions" => [{ "date" => date, "time" => time }] } }, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.7" }, as: :json)
    end

    it "publishes and serves the question without a label" do
      expect(response).to(have_http_status(:ok))

      get("/api/public/forms/#{form.public_id}")

      expect(response).to(have_http_status(:ok))
      booking = json["form"]["fields"].find { |field| field["type"] == "booking" }
      expect(booking).not_to(have_key("label"))
      expect(booking["services"].map { |item| item["name"] }).to(eq(["Haircut"]))
    end

    it "lists the free times and books through the unlabelled question" do
      get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: "2026-11-02", to: "2026-11-03" }, headers: { "CF-Connecting-IP" => "198.51.100.7" })
      expect(response).to(have_http_status(:ok))
      expect(json["slots"].first).to(include("starts_at" => "2026-11-02T09:00:00Z"))

      book

      expect(response).to(have_http_status(:created))
      expect(Appointment.count).to(eq(1))
      expect(Appointment.last).to(have_attributes(client_name: "Ana", status: "confirmed"))
    end
  end
end
