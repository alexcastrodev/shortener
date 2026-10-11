require "rails_helper"

RSpec.describe("a teacher with several lessons", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:days) { ["mon", "tue", "wed", "thu", "fri"] }
  let(:availability) { { "days" => days, "times" => ["10:00", "11:00", "14:00"] } }
  let(:math) { { "name" => "Math", "duration" => 60, "price" => 30, "currency" => "EUR", "capacity" => 1 } }
  let(:physics) { { "name" => "Physics", "duration" => 60, "price" => 40, "currency" => "EUR", "capacity" => 1, "extra_durations" => [{ "duration" => 90, "price" => 55 }], "monthly" => { "price" => 120, "duration" => 45 } } }
  let(:form) { Form.create!(user: current_user, title: "Teacher") }
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
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "mode" => "individual", "availability" => availability, "services" => [math, physics], "rules" => { "approval" => "auto", "window_days" => 60 } })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def service_id(name) = form.reload.fields.find { |field| field["type"] == "booking" }["services"].find { |item| item["name"] == name }["id"]

  def submit(booking, who: "Ana")
    answers = { name_id => who, mail_id => "#{who.downcase}@example.com", booking_id => booking }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_time_zone: "UTC" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def book(name, time, duration: nil, date: "2026-11-03", who: "Ana")
    session = { "date" => date, "time" => time, "duration" => duration }.compact
    submit({ "service" => service_id(name), "sessions" => [session] }, who: who)
  end

  def monthly(name, time: "10:00", weekdays: ["mon"], who: "Ana")
    submit({ "service" => service_id(name), "monthly" => { "month" => "2026-11", "weekdays" => weekdays, "time" => time } }, who: who)
  end

  def offered(name, date: "2026-11-03")
    get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id(name), from: date, to: date })
    json["slots"].to_h { |slot| [slot["time"], slot["durations"]] }
  end

  def cancel(token = json["manage_url"].split("/").last) = post("/api/public/appointments/#{token}/cancel", as: :json)

  it "offers every lesson the same hours of the teacher" do
    expect(offered("Math")).to(eq("10:00" => [60], "11:00" => [60], "14:00" => [60]))
    expect(offered("Physics")).to(eq("10:00" => [60, 90], "11:00" => [60, 90], "14:00" => [60, 90]))
  end

  it "gives the hour to the first lesson booked and hides it from the other" do
    book("Math", "10:00")
    expect(response).to(have_http_status(:created))

    expect(offered("Physics").keys).to(eq(["11:00", "14:00"]))
    book("Physics", "10:00", who: "Bo")
    expect(response).to(have_http_status(:unprocessable_content))
    expect(json.dig("errors", "answers", booking_id)).to(eq(["unavailable"]))
    expect(Appointment.count).to(eq(1))
  end

  it "keeps the hours a longer lesson covers for the same teacher" do
    book("Physics", "10:00", duration: 90)
    expect(response).to(have_http_status(:created))

    expect(offered("Math").keys).to(eq(["14:00"]))
    expect(offered("Physics").keys).to(eq(["14:00"]))
  end

  it "gives the hour back, to any lesson, when the booking is cancelled" do
    book("Math", "10:00")
    cancel
    expect(response).to(have_http_status(:ok))

    expect(offered("Physics").keys).to(eq(["10:00", "11:00", "14:00"]))
    book("Physics", "10:00", who: "Bo")
    expect(response).to(have_http_status(:created))
    expect(AppointmentSlot.where(form_id: form.id).pluck(:service_key, :resource_key, :booked)).to(eq([[service_id("Physics"), "main", 1]]))
  end

  it "lets a lesson that is a class keep adding places, while another lesson stays out" do
    Forms::Definition.update(form, booking_id, { "services" => [math.merge("id" => service_id("Math"), "capacity" => 2), physics.merge("id" => service_id("Physics"))] })
    Forms::Publish.call(form: form.reload)
    book("Math", "10:00")
    book("Math", "10:00", who: "Bo")
    expect(response).to(have_http_status(:created))

    expect(offered("Math").keys).not_to(include("10:00"))
    expect(offered("Physics").keys).not_to(include("10:00"))
  end

  describe "lessons with their own hours" do
    def set_hours(math_hours, physics_hours)
      Forms::Definition.update(form, booking_id, { "services" => [math.merge("id" => service_id("Math")).merge(math_hours), physics.merge("id" => service_id("Physics")).merge(physics_hours)] })
      Forms::Publish.call(form: form.reload)
    end

    it "offers each lesson its own days and times, and the others the hours of the teacher" do
      set_hours({}, { "days" => ["tue", "thu"], "times" => ["13:00"] })

      expect(offered("Math")).to(eq("10:00" => [60], "11:00" => [60], "14:00" => [60]))
      expect(offered("Physics")).to(eq("13:00" => [60, 90]))
      expect(offered("Physics", date: "2026-11-04")).to(eq({}))
      expect(offered("Physics", date: "2026-11-05")).to(eq("13:00" => [60, 90]))
    end

    it "still keeps the teacher out of two lessons at once when the hours overlap" do
      set_hours({ "days" => ["tue"], "times" => ["10:00", "10:30", "12:00"] }, { "days" => ["tue"], "times" => ["10:00", "11:00", "13:00"] })
      book("Physics", "10:00", duration: 90)
      expect(response).to(have_http_status(:created))

      expect(offered("Math").keys).to(eq(["12:00"]))
      expect(offered("Physics").keys).to(eq(["13:00"]))
      book("Math", "10:30", who: "Bo")
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json.dig("errors", "answers", booking_id)).to(eq(["unavailable"]))
      expect(Appointment.count).to(eq(1))
    end
  end

  describe "a class of the teacher" do
    before do
      Forms::Definition.update(form, booking_id, { "services" => [math.merge("id" => service_id("Math"), "capacity" => 2), physics.merge("id" => service_id("Physics"))] })
      Forms::Publish.call(form: form.reload)
    end

    it "does not offer the teacher another hour that overlaps it, to the same lesson or to another" do
      Forms::Definition.update(form, booking_id, { "availability" => { "days" => days, "times" => ["10:00", "10:30", "11:00"] } })
      Forms::Publish.call(form: form.reload)
      book("Math", "10:00")

      expect(offered("Math").keys).to(eq(["10:00", "11:00"]))
      expect(offered("Physics").keys).to(eq(["11:00"]))
      book("Math", "10:30", who: "Bo")
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json.dig("errors", "answers", booking_id)).to(eq(["unavailable"]))
    end

    it "is refused by the database even when the engine is bypassed" do
      Forms::Definition.update(form, booking_id, { "availability" => { "days" => days, "times" => ["10:00", "10:30"] } })
      Forms::Publish.call(form: form.reload)
      book("Math", "10:00")
      starts = Time.utc(2026, 11, 3, 10, 30)

      expect { Appointments::Reserve.call(form: form, service_key: service_id("Physics"), resource_key: "main", capacity: 1, times: [starts], durations: { starts.to_i => 60 }) }.to(raise_error(Appointments::Reserve::Full))
      expect(Appointment.count).to(eq(1))
    end
  end

  describe "the monthly booking of a lesson" do
    it "books every Monday with its own duration and blocks that hour for the others" do
      monthly("Physics")
      expect(response).to(have_http_status(:created))
      expect(Appointment.count).to(eq(5))
      expect(Appointment.pluck(:snapshot).map { |snapshot| snapshot["duration"] }.uniq).to(eq([45]))
      expect(json["price"]).to(eq("total" => 120.0, "currency" => "EUR"))

      expect(offered("Math", date: "2026-11-09").keys).to(eq(["11:00", "14:00"]))
      book("Math", "10:00", date: "2026-11-09", who: "Bo")
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "is refused as a whole when the teacher already has one of those hours" do
      book("Math", "10:00", date: "2026-11-09", who: "Bo")
      monthly("Physics")
      expect(response).to(have_http_status(:unprocessable_content))
      expect(Appointment.count).to(eq(1))
    end
  end

  describe "rescheduling" do
    it "refuses an hour taken by another lesson and accepts a free one" do
      book("Math", "10:00")
      row = Appointment.last
      book("Physics", "11:00", who: "Bo")

      expect(Appointments::Reschedule.call(row: row, date: "2026-11-03", time: "11:00", now: now).status).to(eq(:unavailable))
      expect(Appointments::Reschedule.call(row: row, date: "2026-11-03", time: "14:00", now: now).status).to(eq(:ok))
    end
  end

  describe "days off" do
    it "can close one lesson on a day and leave the others" do
      Forms::Definition.update(form, booking_id, { "exceptions" => [{ "from" => "2026-11-03", "kind" => "closed", "service_ids" => [service_id("Physics")] }] })
      Forms::Publish.call(form: form.reload)

      expect(offered("Physics")).to(eq({}))
      expect(offered("Math").keys).to(eq(["10:00", "11:00", "14:00"]))
    end
  end

  describe "what visitors see after the teacher edits the availability" do
    it "keeps the published availability until the form is published again" do
      Forms::Definition.update(form, booking_id, { "availability" => { "days" => days, "times" => ["09:00"] } })
      expect(offered("Math").keys).to(eq(["10:00", "11:00", "14:00"]))

      Forms::Publish.call(form: form.reload)
      expect(offered("Math").keys).to(eq(["09:00"]))
    end
  end

  describe "the owner's agenda" do
    def agenda
      get("/api/me/agenda", params: { from: "2026-11-03", to: "2026-11-03" }, headers: auth_headers)
      json["sessions"].to_h { |session| [session["starts_at"][11, 5], [session["service_name"], session["booked"]]] }
    end

    it "shows one session per hour of the teacher and the booked one with its lesson" do
      book("Physics", "11:00")
      sessions = agenda
      expect(sessions.keys).to(eq(["10:00", "11:00", "14:00"]))
      expect(sessions["11:00"]).to(eq(["Physics", 1]))
    end
  end

  describe "the impact of changing the availability" do
    it "counts the booking whose hour is no longer offered" do
      book("Math", "14:00")
      Forms::Definition.update(form, booking_id, { "availability" => { "days" => days, "times" => ["10:00", "11:00"] } })

      impact = Appointments::Impact.call(form: form.reload, now: now)
      expect(impact).to(include(upcoming: 1, affected: 1))
      expect(impact[:appointments].first[:reason]).to(eq("time_no_longer_offered"))
    end

    it "counts nothing while every booked hour is still offered" do
      book("Math", "10:00")
      expect(Appointments::Impact.call(form: form.reload, now: now)).to(include(upcoming: 1, affected: 0))
    end
  end
end
