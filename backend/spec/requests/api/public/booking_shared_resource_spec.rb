require "rails_helper"

RSpec.describe("services that share one resource", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:days) { ["mon", "tue", "wed", "thu", "fri"] }
  let(:math) { { "name" => "Math", "duration" => 60, "capacity" => 1, "days" => days, "times" => ["10:00", "11:00", "14:00"] } }
  let(:physics) { { "name" => "Physics", "duration" => 60, "price" => 40, "currency" => "EUR", "extra_durations" => [{ "duration" => 90, "price" => 55 }], "capacity" => 1, "days" => days, "times" => ["10:00", "11:00", "14:00"] } }
  let(:alone) { { "name" => "Piano", "duration" => 60, "capacity" => 1, "days" => days, "times" => ["10:00", "11:00", "14:00"] } }
  let(:services) { [math, physics] }
  let(:form) { Form.create!(user: current_user, title: "Studio") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }

  around do |example|
    previous = ENV["GMAIL_USERNAME"]
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    example.run
  ensure
    ENV["GMAIL_USERNAME"] = previous
  end

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    allow(Appointments::Resource).to(receive(:key).and_wrap_original { |original, service| ["Math", "Physics"].include?(service["name"]) ? "main" : original.call(service) })
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => services, "rules" => { "approval" => "auto", "window_days" => 60 } })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def service_id(name) = form.reload.fields.find { |field| field["type"] == "booking" }["services"].find { |item| item["name"] == name }["id"]

  def book(name, time, duration: nil, date: "2026-11-03", who: "Ana")
    session = { "date" => date, "time" => time, "duration" => duration }.compact
    answers = { name_id => who, mail_id => "#{who.downcase}@example.com", booking_id => { "service" => service_id(name), "sessions" => [session] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_time_zone: "UTC" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def offered(name, date: "2026-11-03")
    get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id(name), from: date, to: date })
    json["slots"].to_h { |slot| [slot["time"], slot["durations"]] }
  end

  it "gives the hour to the first service and hides it from the other" do
    book("Math", "10:00")
    expect(response).to(have_http_status(:created))

    expect(offered("Physics")).to(eq("11:00" => [60, 90], "14:00" => [60, 90]))
    book("Physics", "10:00", who: "Bo")
    expect(response).to(have_http_status(:unprocessable_content))
    expect(json.dig("errors", "answers", booking_id)).to(eq(["unavailable"]))
    expect(Appointment.count).to(eq(1))
  end

  it "only offers the durations that end before the other service starts" do
    book("Math", "11:00")
    expect(offered("Physics")).to(eq("10:00" => [60], "14:00" => [60, 90]))
    book("Physics", "10:00", duration: 90, who: "Bo")
    expect(response).to(have_http_status(:unprocessable_content))
    book("Physics", "10:00", duration: 60, who: "Bo")
    expect(response).to(have_http_status(:created))
  end

  it "gives the hour to the other service once the booking is cancelled" do
    book("Math", "10:00")
    token = json["manage_url"].split("/").last
    post("/api/public/appointments/#{token}/cancel", as: :json)
    expect(response).to(have_http_status(:ok))

    expect(offered("Physics").keys).to(eq(["10:00", "11:00", "14:00"]))
    book("Physics", "10:00", who: "Bo")
    expect(response).to(have_http_status(:created))
    expect(AppointmentSlot.where(form_id: form.id).pluck(:service_key, :resource_key, :booked)).to(eq([[service_id("Physics"), "main", 1]]))
  end

  it "keeps the other service out of an hour where a class still has room" do
    Forms::Definition.update(form, booking_id, { "services" => [math.merge("id" => service_id("Math"), "capacity" => 2), physics.merge("id" => service_id("Physics"))] })
    Forms::Publish.call(form: form.reload)
    book("Math", "10:00")

    expect(offered("Math").keys).to(include("10:00"))
    expect(offered("Physics").keys).not_to(include("10:00"))
    book("Math", "10:00", who: "Bo")
    expect(response).to(have_http_status(:created))
  end

  describe "a service of its own resource" do
    let(:services) { [math, physics, alone] }

    it "is not affected" do
      book("Math", "10:00")
      expect(offered("Piano").keys).to(eq(["10:00", "11:00", "14:00"]))
      book("Piano", "10:00", who: "Bo")
      expect(response).to(have_http_status(:created))
    end
  end

  describe "rescheduling" do
    it "refuses an hour taken by the other service" do
      book("Math", "10:00")
      row = Appointment.last
      book("Physics", "11:00", who: "Bo")

      expect(Appointments::Reschedule.call(row: row, date: "2026-11-03", time: "11:00", now: now).status).to(eq(:unavailable))
      expect(Appointments::Reschedule.call(row: row, date: "2026-11-03", time: "14:00", now: now).status).to(eq(:ok))
    end
  end

  describe "the owner's agenda" do
    def agenda
      get("/api/me/agenda", params: { from: "2026-11-03", to: "2026-11-03" }, headers: auth_headers)
      json["sessions"].to_h { |session| [session["starts_at"][11, 5], session["service_name"]] }
    end

    it "shows one session per hour of the resource, and the booked one with the service that holds it" do
      book("Physics", "11:00")
      sessions = agenda
      expect(sessions.keys).to(eq(["10:00", "11:00", "14:00"]))
      expect(sessions["11:00"]).to(eq("Physics"))
    end
  end
end
