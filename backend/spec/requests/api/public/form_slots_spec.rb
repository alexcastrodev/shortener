require "rails_helper"

RSpec.describe("GET /api/public/forms/:public_id/slots", type: :request) do
  let(:owner) { FactoryBot.create(:user) }
  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed"], "times" => ["09:00", "10:00", "11:00"] } }
  let(:rules) { {} }
  let(:name) { { "id" => "name0001", "type" => "short_text", "label" => "Name", "required" => true } }
  let(:email) { { "id" => "mail0001", "type" => "email", "label" => "Email", "required" => true } }
  let(:form) { Form.create!(user: owner, title: "Salon") }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => rules })
    Forms::Definition.add(form.reload, name)
    Forms::Definition.add(form.reload, email)
    Forms::Publish.call(form: form.reload)
  end

  def json
    JSON.parse(response.body)
  end

  def slots(from: "2026-11-02", to: "2026-11-04", service: service_id, id: form.public_id, headers: {})
    get("/api/public/forms/#{id}/slots", params: { service: service, from: from, to: to }, headers: { "CF-Connecting-IP" => "198.51.100.7" }.merge(headers))
  end

  def times
    json["slots"].map { |slot| slot["starts_at"] }
  end

  describe "listing" do
    it "lists the free times of the requested days in order, in UTC, with the form time zone" do
      slots
      expect(response).to(have_http_status(:ok))
      expect(json["time_zone"]).to(eq("UTC"))
      expected = ["02", "03", "04"].product(["09", "10", "11"]).map { |day, hour| "2026-11-#{day}T#{hour}:00:00Z" }
      expect(times).to(eq(expected))
      expect(json["slots"].first).to(eq("starts_at" => "2026-11-02T09:00:00Z", "date" => "2026-11-02", "time" => "09:00", "remaining" => 1))
    end

    it "skips the days the service does not run" do
      slots(from: "2026-11-05", to: "2026-11-08")
      expect(json["slots"]).to(eq([]))
    end

    it "never returns a time in the past" do
      travel_to(Time.utc(2026, 11, 2, 10, 30)) { slots(from: "2026-11-02", to: "2026-11-02") }
      expect(times).to(eq(["2026-11-02T11:00:00Z"]))
    end

    it "is the owner's local time, shifted correctly across daylight saving" do
      Forms::Definition.update(form.reload, form.fields.first["id"], { "rules" => { "time_zone" => "Europe/Lisbon", "approval" => "auto" } })
      Forms::Publish.call(form: form.reload)
      travel_to(Time.utc(2026, 3, 20)) do
        slots(from: "2026-03-23", to: "2026-03-31")
        expect(json["time_zone"]).to(eq("Europe/Lisbon"))
        expect(times.select { |time| time.start_with?("2026-03-24") }.first).to(eq("2026-03-24T09:00:00Z"))
        expect(times.select { |time| time.start_with?("2026-03-31") }.first).to(eq("2026-03-31T08:00:00Z"))
      end
    end
  end

  describe "rules" do
    let(:rules) { { "min_notice_minutes" => 150, "window_days" => 3, "buffer_minutes" => 0 } }

    it "hides times that are closer than the minimum notice" do
      slots(from: "2026-11-02", to: "2026-11-02")
      expect(times).to(eq(["2026-11-02T11:00:00Z"]))
    end

    it "does not look further ahead than the booking window" do
      slots(from: "2026-11-02", to: "2026-11-30")
      expect(json["slots"].map { |slot| slot["date"] }.uniq).to(eq(["2026-11-02", "2026-11-03", "2026-11-04"]))
    end

    describe "per-day limit" do
      let(:rules) { { "max_per_day" => 2 } }

      it "closes a day once its bookings reach the limit" do
        AppointmentSlot.create!(form: form, service_key: service_id, starts_at: Time.utc(2026, 11, 3, 9), capacity: 1, booked: 1)
        AppointmentSlot.create!(form: form, service_key: "other001", starts_at: Time.utc(2026, 11, 3, 15), capacity: nil, booked: 1)
        slots
        expect(json["slots"].map { |slot| slot["date"] }.uniq).to(eq(["2026-11-02", "2026-11-04"]))
      end
    end

    describe "gap between sessions" do
      let(:rules) { { "buffer_minutes" => 30 } }

      it "hides times too close to a session that is already full" do
        AppointmentSlot.create!(form: form, service_key: service_id, starts_at: Time.utc(2026, 11, 2, 10), capacity: 1, booked: 1)
        slots(from: "2026-11-02", to: "2026-11-02")
        expect(times).to(eq([]))
      end
    end
  end

  describe "places" do
    let(:service) { super().merge("capacity" => 2) }

    it "shows how many places remain" do
      AppointmentSlot.create!(form: form, service_key: service_id, starts_at: Time.utc(2026, 11, 2, 9), capacity: 2, booked: 1)
      slots(from: "2026-11-02", to: "2026-11-02")
      expect(json["slots"].first).to(include("time" => "09:00", "remaining" => 1))
    end

    it "hides a time that is full" do
      AppointmentSlot.create!(form: form, service_key: service_id, starts_at: Time.utc(2026, 11, 2, 9), capacity: 2, booked: 2)
      slots(from: "2026-11-02", to: "2026-11-02")
      expect(times).not_to(include("2026-11-02T09:00:00Z"))
    end

    it "reports no limit for unlimited places" do
      Forms::Definition.update(form.reload, form.fields.first["id"], { "services" => [service.merge("id" => service_id, "capacity" => nil)] })
      Forms::Publish.call(form: form.reload)
      slots(from: "2026-11-02", to: "2026-11-02")
      expect(json["slots"].first["remaining"]).to(be_nil)
    end
  end

  describe "what is served" do
    it "reads the published snapshot, not the draft" do
      Forms::Definition.update(form.reload, form.fields.first["id"], { "services" => [service.merge("id" => service_id, "times" => ["14:00"])] })
      slots(from: "2026-11-02", to: "2026-11-02")
      expect(times).to(eq(["2026-11-02T09:00:00Z", "2026-11-02T10:00:00Z", "2026-11-02T11:00:00Z"]))
    end

    it "exposes only the slot keys" do
      slots
      expect(json.keys).to(match_array(["time_zone", "slots"]))
      expect(json["slots"].first.keys).to(match_array(["starts_at", "date", "time", "remaining"]))
      expect(response.headers["Set-Cookie"]).to(be_nil)
    end
  end

  describe "access" do
    it "answers 404 for an unpublished form, an unknown service and a malformed id" do
      Forms::Unpublish.call(form: form.reload)
      slots
      expect(response).to(have_http_status(:not_found))
      Forms::Publish.call(form: form.reload)
      slots(service: "nope0000")
      expect(response).to(have_http_status(:not_found))
      slots(id: "../etc/passwd")
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "the requested range" do
    it "answers 422 for a malformed date, a reversed range and a window over 62 days" do
      slots(from: "tomorrow")
      expect(response).to(have_http_status(:unprocessable_content))
      slots(from: "2026-11-05", to: "2026-11-02")
      expect(response).to(have_http_status(:unprocessable_content))
      slots(from: "2026-11-02", to: "2027-01-31")
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "accepts exactly 62 days" do
      slots(from: "2026-11-02", to: "2027-01-02")
      expect(response).to(have_http_status(:ok))
    end
  end

  it "answers 429 after 120 requests a minute from one IP, and only that IP" do
    120.times { slots }
    slots
    expect(response).to(have_http_status(:too_many_requests))
    slots(headers: { "CF-Connecting-IP" => "203.0.113.9" })
    expect(response).to(have_http_status(:ok))
  end
end
