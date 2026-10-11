require "rails_helper"

RSpec.describe("sessions with several durations", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) do
    {
      "name" => "Piano",
      "duration" => 60,
      "price" => 40,
      "currency" => "EUR",
      "capacity" => 1,
      "extra_durations" => [{ "duration" => 90, "price" => 55 }],
      "monthly" => { "price" => 120, "duration" => 45 },
      "days" => ["mon", "tue", "wed", "thu", "fri"],
      "times" => ["09:00", "10:00", "11:00", "14:00"],
    }
  end
  let(:form) { Form.create!(user: current_user, title: "Studio") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }

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
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => { "approval" => "auto", "window_days" => 90 } })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def submit(booking, name: "Ana")
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => booking }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_time_zone: "UTC" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def book(*sessions, **options)
    submit({ "service" => service_id, "sessions" => sessions.map { |date, time, duration| { "date" => date, "time" => time, "duration" => duration }.compact } }, **options)
  end

  def monthly(time: "09:00", weekdays: ["mon"])
    submit({ "service" => service_id, "monthly" => { "month" => "2026-11", "weekdays" => weekdays, "time" => time } })
  end

  def offered(day)
    get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: day, to: day })
    json["slots"].to_h { |slot| [slot["time"], slot["durations"]] }
  end

  def snapshots = Appointment.joins(:slot).order("appointment_slots.starts_at").map(&:snapshot)

  it "offers every duration of the service on a free day" do
    expect(offered("2026-11-03")).to(eq("09:00" => [60, 90], "10:00" => [60, 90], "11:00" => [60, 90], "14:00" => [60, 90]))
  end

  it "books each session with its own duration and price and adds them up" do
    book(["2026-11-03", "09:00", 60], ["2026-11-04", "11:00", 90])

    expect(response).to(have_http_status(:created))
    expect(json["appointments"].pluck("duration")).to(eq([60, 90]))
    expect(json["price"]).to(eq("total" => 95.0, "currency" => "EUR"))
    expect(snapshots.map { |item| item.values_at("duration", "price", "total") }).to(eq([[60, 40, 95.0], [90, 55, 95.0]]))
    expect(AppointmentSlot.order(:starts_at).pluck(:duration)).to(eq([60, 90]))
    expect(FormResponse.last.answers[booking_id]["sessions"].pluck("duration")).to(eq([60, 90]))
  end

  it "uses the main duration when the session names none" do
    book(["2026-11-03", "09:00", nil])

    expect(response).to(have_http_status(:created))
    expect(snapshots.first).to(include("duration" => 60, "price" => 40, "total" => 40.0))
  end

  it "refuses a duration the service does not offer" do
    [45, 120, "60", 0, 60.0].each do |minutes|
      book(["2026-11-03", "09:00", minutes])
      expect(response).to(have_http_status(:unprocessable_content), minutes.inspect)
    end
    expect(Appointment.count).to(eq(0))
  end

  it "hides the times a long booking covers and refuses them" do
    book(["2026-11-03", "09:00", 90])

    expect(offered("2026-11-03")).to(eq("11:00" => [60, 90], "14:00" => [60, 90]))
    book(["2026-11-03", "10:00", 60], name: "Bo")
    expect(response).to(have_http_status(:unprocessable_content))
    expect(json.dig("errors", "answers", booking_id)).to(eq(["unavailable"]))
  end

  it "only offers a long duration where it does not run into the next booking" do
    book(["2026-11-03", "11:00", 60])

    expect(offered("2026-11-03")).to(include("09:00" => [60, 90], "10:00" => [60]))
    book(["2026-11-03", "10:00", 90], name: "Bo")
    expect(response).to(have_http_status(:unprocessable_content))
    book(["2026-11-03", "10:00", 60], name: "Bo")
    expect(response).to(have_http_status(:created))
  end

  it "gives the time back, whatever its length, when the booking is cancelled" do
    book(["2026-11-03", "09:00", 90])
    Appointments::Release.call(AppointmentSlot.pluck(:id))

    expect(offered("2026-11-03")["10:00"]).to(eq([60, 90]))
  end

  describe "the fixed monthly booking" do
    it "uses its own duration and its own price" do
      monthly

      expect(response).to(have_http_status(:created))
      expect(snapshots.map { |item| item["duration"] }.uniq).to(eq([45]))
      expect(json["price"]).to(eq("total" => 120.0, "currency" => "EUR"))
      expect(json["appointments"].pluck("duration").uniq).to(eq([45]))
    end

    it "falls back to the duration of the service" do
      Forms::Definition.update(form, booking_id, { "services" => [service.merge("id" => service_id, "monthly" => { "price" => 120 })] })
      Forms::Publish.call(form: form.reload)
      monthly

      expect(snapshots.map { |item| item["duration"] }.uniq).to(eq([60]))
    end

    it "blocks the neighbouring time by its own length" do
      book(["2026-11-09", "09:00", 90], name: "Bo")
      monthly(time: "10:00", weekdays: ["mon"])

      expect(response).to(have_http_status(:unprocessable_content))
    end
  end

  describe "rescheduling" do
    it "keeps the duration of the appointment and refuses a time where it does not fit" do
      book(["2026-11-03", "09:00", 90])
      book(["2026-11-03", "14:00", 60], name: "Bo")
      row = Appointment.find_by(client_name: "Ana")

      expect(Appointments::Reschedule.call(row: row, date: "2026-11-03", time: "14:00", now: now).status).to(eq(:unavailable))
      moved = Appointments::Reschedule.call(row: row, date: "2026-11-04", time: "11:00", now: now)

      expect(moved.status).to(eq(:ok))
      expect(moved.record.snapshot["duration"]).to(eq(90))
      expect(moved.record.slot.duration).to(eq(90))
    end

    it "refuses a time that would run into another booking" do
      book(["2026-11-03", "09:00", 90])
      book(["2026-11-04", "11:00", 60], name: "Bo")
      row = Appointment.find_by(client_name: "Ana")

      expect(Appointments::Reschedule.call(row: row, date: "2026-11-04", time: "10:00", now: now).status).to(eq(:unavailable))
    end
  end
end
