require "rails_helper"

RSpec.describe("different times on different weekdays", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:by_day) { { "mon" => ["09:00"], "wed" => ["14:00", "15:00"], "fri" => [] } }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed", "fri"], "times" => ["10:00", "11:00"], "times_by_day" => by_day } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
    travel_to(now)
  end

  def json = JSON.parse(response.body)

  def add_booking(services, extra = {})
    post("/api/me/forms/#{form.id}/fields", params: { type: "booking", label: "When", services: services }.merge(extra), headers: auth_headers, as: :json)
  end

  def setup_published
    add_booking([service])
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def times_on(date)
    get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: date, to: date }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" })
    json["slots"].map { |slot| slot["time"] }
  end

  describe "storing" do
    it "keeps the weekday lists and returns them to the owner" do
      add_booking([service])
      expect(response).to(have_http_status(:created))
      stored = json["form"]["fields"].first["services"].first
      expect(stored["times_by_day"]).to(eq(by_day))
      expect(stored["times"]).to(eq(["10:00", "11:00"]))
    end

    it "works without them, as before" do
      add_booking([service.except("times_by_day")])
      expect(response).to(have_http_status(:created))
      expect(json["form"]["fields"].first["services"].first).not_to(have_key("times_by_day"))
    end

    it "keeps them when the service is edited without them" do
      add_booking([service])
      field = json["form"]["fields"].first
      sid = field["services"].first["id"]
      patch("/api/me/forms/#{form.id}/fields/#{field["id"]}", params: { services: [service.merge("id" => sid, "name" => "Cut", "times_by_day" => by_day)] }, headers: auth_headers, as: :json)
      expect(json["form"]["fields"].first["services"].first).to(include("name" => "Cut", "times_by_day" => by_day))
    end

    it "drops a day name it does not know" do
      add_booking([service.merge("times_by_day" => { "mon" => ["09:00"], "funday" => ["09:00"] })])
      expect(json["form"]["fields"].first["services"].first["times_by_day"]).to(eq("mon" => ["09:00"]))
    end

    {
      "a day the service does not run" => { "thu" => ["09:00"] },
      "a malformed time" => { "mon" => ["9am"] },
      "a time past midnight" => { "mon" => ["24:00"] },
      "repeated times" => { "mon" => ["09:00", "09:00"] },
      "more than 96 times" => { "mon" => (0...97).map { |index| format("%02d:%02d", index / 4 % 24, index % 4 * 15) }.uniq + ["23:59"] },
      "something that is not a list" => { "mon" => "09:00" },
    }.each do |label, invalid|
      it "rejects #{label}" do
        add_booking([service.merge("times_by_day" => invalid)])
        expect(response).to(have_http_status(:unprocessable_entity))
        expect(form.reload.fields).to(eq([]))
      end
    end
  end

  describe "what visitors can book" do
    before { setup_published }

    it "offers each weekday its own times" do
      expect(times_on("2026-11-09")).to(eq(["09:00"]))
      expect(times_on("2026-11-11")).to(eq(["14:00", "15:00"]))
    end

    it "falls back to the general times on a weekday without its own list" do
      expect(times_on("2026-11-10")).to(eq(["10:00", "11:00"]))
    end

    it "closes a weekday whose list is empty" do
      expect(times_on("2026-11-13")).to(eq([]))
    end

    it "does not open weekdays the service does not run" do
      expect(times_on("2026-11-12")).to(eq([]))
    end

    it "lets a special-hours exception override the weekday list" do
      patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { exceptions: [{ from: "2026-11-09", kind: "special", times: ["16:00"] }] }, headers: auth_headers, as: :json)
      Forms::Publish.call(form: form.reload)
      expect(times_on("2026-11-09")).to(eq(["16:00"]))
      expect(times_on("2026-11-16")).to(eq(["09:00"]))
    end

    it "validates a booking against the weekday's own times" do
      book = lambda do |date, time|
        answers = {
          form.reload.fields.find { |field| field["type"] == "short_text" }["id"] => "Ana",
          form.fields.find { |field| field["type"] == "email" }["id"] => "ana@example.com",
          booking_id => { "service" => service_id, "sessions" => [{ "date" => date, "time" => time }] },
        }
        post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
      end
      book.call("2026-11-09", "10:00")
      expect(response).to(have_http_status(:unprocessable_entity))
      book.call("2026-11-09", "09:00")
      expect(response).to(have_http_status(:created))
      book.call("2026-11-11", "15:00")
      expect(response).to(have_http_status(:created))
    end

    it "projects the owner's agenda with each weekday's times" do
      get("/api/me/agenda", params: { from: "2026-11-09", to: "2026-11-11" }, headers: auth_headers)
      expect(json["sessions"].map { |item| item["starts_at"] }).to(eq(["2026-11-09T09:00:00Z", "2026-11-10T10:00:00Z", "2026-11-10T11:00:00Z", "2026-11-11T14:00:00Z", "2026-11-11T15:00:00Z"]))
    end

    it "does not expose the weekday lists in the public form, only the general ones" do
      get("/api/public/forms/#{form.public_id}")
      expect(response.body).not_to(include("times_by_day"))
    end
  end
end
