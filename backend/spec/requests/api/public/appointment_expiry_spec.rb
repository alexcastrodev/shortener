require "rails_helper"

RSpec.describe("pending requests that nobody answers", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:rules) { { "approval" => "manual", "approval_timeout_minutes" => 60 } }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed"], "times" => ["09:00", "10:00", "11:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
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
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => rules })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def book(list, name: "Ana", ip: "198.51.100.7")
    sessions = list.map { |date, time| { "date" => date, "time" => time } }
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => sessions } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  def free_times
    get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: "2026-11-03", to: "2026-11-03" }, headers: { "CF-Connecting-IP" => "198.51.100.99" })
    json["slots"].map { |slot| slot["time"] }
  end

  def manage_status(appointment)
    token = AppointmentToken.issue(booking: appointment, expires_at: now + 30.days)
    get("/api/public/appointments/#{token}")
    json.dig("appointment", "status")
  end

  def resolve(at)
    travel_to(at) { perform_enqueued_jobs { ResolvePendingAppointmentsJob.perform_now } }
  end

  before { book([["2026-11-03", "09:00"]]) }

  it "holds the place while the request is waiting" do
    expect(free_times).to(eq(["10:00", "11:00"]))
    resolve(now + 59.minutes)
    expect(Appointment.pluck(:status)).to(eq(["pending"]))
    expect(free_times).to(eq(["10:00", "11:00"]))
  end

  it "declines it at the deadline, frees the place and tells the client and the owner" do
    deliveries.clear
    resolve(now + 61.minutes)

    appointment = Appointment.first
    expect(appointment).to(have_attributes(status: "declined", decided_by: "timeout", decided_at: now + 61.minutes))
    expect(free_times).to(eq(["09:00", "10:00", "11:00"]))
    expect(manage_status(appointment)).to(eq("cancelled"))
    expect(deliveries.map(&:to)).to(eq([["ana@example.com"]]))
    expect(deliveries.last.subject).to(start_with("Not confirmed: Haircut"))

    get("/api/me/notifications", headers: auth_headers)
    expect(json["notifications"].map { |row| row["kind"] }).to(include("appointment_expired"))
  end

  it "lets someone else book the freed time" do
    resolve(now + 2.hours)
    travel_to(now + 2.hours) { book([["2026-11-03", "09:00"]], name: "Bo", ip: "198.51.100.8") }
    expect(response).to(have_http_status(:created))
  end

  it "does nothing the second time and sends one email only" do
    deliveries.clear
    resolve(now + 61.minutes)
    resolve(now + 62.minutes)
    expect(deliveries.size).to(eq(1))
    expect(AppointmentSlot.sum(:booked)).to(eq(0))
  end

  it "resolves a multi-day request as one and only what is overdue" do
    book([["2026-11-03", "10:00"], ["2026-11-04", "09:00"]], name: "Cy", ip: "198.51.100.9")
    travel_to(now + 90.minutes) { book([["2026-11-03", "11:00"]], name: "Di", ip: "198.51.100.10") }
    deliveries.clear
    resolve(now + 2.hours)

    expect(Appointment.order(:id).pluck(:client_name, :status)).to(eq([["Ana", "declined"], ["Cy", "declined"], ["Cy", "declined"], ["Di", "pending"]]))
    expect(deliveries.size).to(eq(2))
    expect(AppointmentSlot.sum(:booked)).to(eq(1))
  end

  it "never touches confirmed or already decided appointments" do
    Appointment.first.update!(status: "confirmed")
    resolve(now + 1.day)
    expect(Appointment.pluck(:status)).to(eq(["confirmed"]))
    expect(AppointmentSlot.sum(:booked)).to(eq(1))
  end

  describe "when the owner chose to accept on timeout" do
    let(:rules) { { "approval" => "manual", "approval_timeout_minutes" => 60, "approval_on_timeout" => "accept" } }

    it "confirms the booking at the deadline, keeps the places and tells the client and the owner" do
      deliveries.clear
      resolve(now + 61.minutes)

      appointment = Appointment.first
      expect(appointment).to(have_attributes(status: "confirmed", decided_by: "timeout", decided_at: now + 61.minutes))
      expect(free_times).to(eq(["10:00", "11:00"]))
      expect(manage_status(appointment)).to(eq("confirmed"))
      expect(deliveries.map(&:to)).to(eq([["ana@example.com"]]))
      expect(deliveries.last.subject).to(start_with("Confirmed: Haircut"))
      get("/api/me/notifications", headers: auth_headers)
      expect(json["notifications"].map { |row| row["kind"] }).to(include("appointment_auto_confirmed"))
    end

    it "declines instead when a session has already started by the deadline" do
      Appointment.first.slot.update!(starts_at: now + 30.minutes)
      resolve(now + 61.minutes)
      expect(Appointment.pluck(:status)).to(eq(["declined"]))
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
    end

    it "does it once even if the sweep runs again" do
      deliveries.clear
      resolve(now + 61.minutes)
      resolve(now + 62.minutes)
      expect(deliveries.size).to(eq(1))
      expect(Appointment.pluck(:status)).to(eq(["confirmed"]))
    end

    it "keeps the choice made at booking time if the owner changes it later" do
      Forms::Definition.update(form.reload, booking_id, { "rules" => { "approval_on_timeout" => "decline" } })
      resolve(now + 2.hours)
      expect(Appointment.pluck(:status)).to(eq(["confirmed"]))
    end
  end

  it "reports how late the oldest overdue request is" do
    expect(Appointments::ResolveExpired.lag(now: now + 30.minutes)).to(eq(0))
    expect(Appointments::ResolveExpired.lag(now: now + 70.minutes)).to(eq(600))
  end

  it "is scheduled every minute" do
    schedule = YAML.safe_load(ERB.new(Rails.root.join("config/recurring.yml").read).result)["production"]
    expect(schedule["resolve_pending_appointments"]).to(include("class" => "ResolvePendingAppointmentsJob", "schedule" => "every minute"))
  end
end
