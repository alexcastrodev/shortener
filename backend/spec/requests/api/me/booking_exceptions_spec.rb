require "rails_helper"

RSpec.describe("days off, holidays and special hours", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"] } }
  let(:second_service) { { "name" => "Beard", "duration" => 30, "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_ids) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].map { |item| item["id"] } }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service, second_service] })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def set_exceptions(list, headers: auth_headers)
    patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { exceptions: list }, headers: headers, as: :json)
  end

  def publish!
    Forms::Publish.call(form: form.reload)
  end

  def times_on(date, service: service_ids.first)
    get("/api/public/forms/#{form.public_id}/slots", params: { service: service, from: date, to: date }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" })
    json["slots"].map { |slot| slot["time"] }
  end

  describe "storing them" do
    it "keeps the list with generated ids, and keeps them across an unrelated edit" do
      set_exceptions([{ from: "2026-12-25", kind: "closed", note: "Christmas" }, { from: "2026-12-31", kind: "special", times: ["09:00"] }])
      expect(response).to(have_http_status(:ok))
      stored = json["form"]["fields"].find { |field| field["type"] == "booking" }["exceptions"]
      expect(stored.map { |item| item["kind"] }).to(eq(["closed", "special"]))
      expect(stored.map { |item| item["id"] }).to(all(match(/\A[A-Za-z0-9]{8}\z/)))

      patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { rules: { window_days: 90 } }, headers: auth_headers, as: :json)
      expect(form.reload.fields.find { |field| field["type"] == "booking" }["exceptions"].size).to(eq(2))
    end

    it "starts empty on a new booking question" do
      other = Form.create!(user: current_user, title: "New")
      post("/api/me/forms/#{other.id}/fields", params: { type: "booking", label: "When" }, headers: auth_headers, as: :json)
      expect(json["form"]["fields"].first["exceptions"]).to(eq([]))
    end

    {
      "a malformed date" => { from: "25/12/2026", kind: "closed" },
      "an impossible date" => { from: "2026-02-30", kind: "closed" },
      "an end before the start" => { from: "2026-12-25", to: "2026-12-20", kind: "closed" },
      "a span of more than a year" => { from: "2026-01-01", to: "2027-12-31", kind: "closed" },
      "an unknown kind" => { from: "2026-12-25", kind: "party" },
      "special hours without times" => { from: "2026-12-25", kind: "special" },
      "special hours with a bad time" => { from: "2026-12-25", kind: "special", times: ["9am"] },
      "special hours with repeated times" => { from: "2026-12-25", kind: "special", times: ["09:00", "09:00"] },
      "times on a closed day" => { from: "2026-12-25", kind: "closed", times: ["09:00"] },
      "a service that does not exist" => { from: "2026-12-25", kind: "closed", service_ids: ["nope0000"] },
      "a note over 200 characters" => { from: "2026-12-25", kind: "closed", note: "x" * 201 },
    }.each do |label, item|
      it "rejects #{label}" do
        set_exceptions([item])
        expect(response).to(have_http_status(:unprocessable_entity))
        expect(form.reload.fields.find { |field| field["type"] == "booking" }["exceptions"]).to(eq([]))
      end
    end

    it "rejects more than 100 exceptions" do
      set_exceptions(Array.new(101) { |index| { from: (Date.new(2027, 1, 1) + index).iso8601, kind: "closed" } })
      expect(response).to(have_http_status(:unprocessable_entity))
    end
  end

  describe "what visitors can book" do
    it "closes a single day off" do
      expect(times_on("2026-11-09")).to(eq(["09:00", "10:00"]))
      set_exceptions([{ from: "2026-11-09", kind: "closed" }])
      publish!
      expect(times_on("2026-11-09")).to(eq([]))
      expect(times_on("2026-11-10")).to(eq(["09:00", "10:00"]))
    end

    it "closes a whole holiday range, ends included" do
      set_exceptions([{ from: "2026-11-09", to: "2026-11-11", kind: "closed" }])
      publish!
      expect(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"].map { |day| times_on(day) }).to(eq([[], [], [], [], ["09:00", "10:00"]]))
    end

    it "replaces the usual times on a special day" do
      set_exceptions([{ from: "2026-11-10", kind: "special", times: ["14:00", "15:00"] }])
      publish!
      expect(times_on("2026-11-10")).to(eq(["14:00", "15:00"]))
      expect(times_on("2026-11-11")).to(eq(["09:00", "10:00"]))
    end

    it "does not open a weekday the service does not run, even with special hours" do
      set_exceptions([{ from: "2026-11-14", kind: "special", times: ["09:00"] }])
      publish!
      expect(times_on("2026-11-14")).to(eq([]))
    end

    it "applies to the listed services only" do
      first, second = service_ids
      set_exceptions([{ from: "2026-11-10", kind: "closed", service_ids: [second] }])
      publish!
      expect(times_on("2026-11-10", service: first)).to(eq(["09:00", "10:00"]))
      expect(times_on("2026-11-10", service: second)).to(eq([]))
    end

    it "lets a closed day win over special hours on the same day" do
      set_exceptions([{ from: "2026-11-10", kind: "special", times: ["14:00"] }, { from: "2026-11-09", to: "2026-11-11", kind: "closed" }])
      publish!
      expect(times_on("2026-11-10")).to(eq([]))
    end

    it "refuses a booking on a closed day and accepts one on a special-hours time" do
      set_exceptions([{ from: "2026-11-09", kind: "closed" }, { from: "2026-11-10", kind: "special", times: ["14:00"] }])
      publish!
      book = lambda do |date, time|
        answers = { name_id => "Ana", mail_id => "ana@example.com", booking_id => { "service" => service_ids.first, "sessions" => [{ "date" => date, "time" => time }] } }
        post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
      end
      book.call("2026-11-09", "09:00")
      expect(response).to(have_http_status(:unprocessable_entity))
      book.call("2026-11-10", "09:00")
      expect(response).to(have_http_status(:unprocessable_entity))
      book.call("2026-11-10", "14:00")
      expect(response).to(have_http_status(:created))
    end

    it "does not show exceptions or their notes to visitors" do
      set_exceptions([{ from: "2026-12-25", kind: "closed", note: "Private holiday plan" }])
      publish!
      get("/api/public/forms/#{form.public_id}")
      expect(response.body).not_to(include("Private holiday plan", "exceptions"))
    end

    it "keeps serving the published exceptions until the change is published" do
      set_exceptions([{ from: "2026-11-09", kind: "closed" }])
      expect(times_on("2026-11-09")).to(eq(["09:00", "10:00"]))
      publish!
      expect(times_on("2026-11-09")).to(eq([]))
    end
  end

  describe "the owner's agenda" do
    def agenda_days
      get("/api/me/agenda", params: { from: "2026-11-09", to: "2026-11-12" }, headers: auth_headers)
      json["sessions"].map { |item| [item["date"], item["service_id"] == service_ids.first] }.select(&:last).map(&:first).uniq
    end

    it "does not project sessions onto a closed day" do
      set_exceptions([{ from: "2026-11-10", kind: "closed" }])
      publish!
      expect(agenda_days).to(eq(["2026-11-09", "2026-11-11", "2026-11-12"]))
    end

    it "keeps a session that was already booked on a day that was closed afterwards" do
      slot = AppointmentSlot.create!(form: form, service_key: service_ids.first, starts_at: Time.utc(2026, 11, 10, 9), capacity: 1, booked: 1)
      Appointment.create!(form: form, response: FormResponse.create!(form: form, answers: {}), slot: slot, group_key: SecureRandom.uuid, status: "confirmed", client_name: "Ana", snapshot: { "name" => "Haircut" })
      set_exceptions([{ from: "2026-11-10", kind: "closed" }])
      publish!
      expect(agenda_days).to(include("2026-11-10"))
      expect(json["sessions"].find { |item| item["starts_at"] == "2026-11-10T09:00:00Z" }["booked"]).to(eq(1))
    end
  end

  it "answers 401 without a token" do
    set_exceptions([{ from: "2026-12-25", kind: "closed" }], headers: {})
    expect(response).to(have_http_status(:unauthorized))
  end
end
