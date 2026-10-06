require "rails_helper"

RSpec.describe("deciding a booking request from the owner's link", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "price" => 25, "currency" => "EUR", "capacity" => 1, "days" => ["mon", "tue", "wed"], "times" => ["09:00", "10:00", "11:00"] } }
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
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => { "approval" => "manual", "approval_timeout_minutes" => 60 } })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def book(list, name: "Ana", ip: "198.51.100.7")
    sessions = list.map { |date, time| { "date" => date, "time" => time } }
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => sessions } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", client_time_zone: "Europe/Lisbon" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  def decide_token(expires_at: now + 30.days)
    AppointmentToken.issue(booking: Appointment.order(:id).first, expires_at: expires_at, purpose: "decide")
  end

  def json = JSON.parse(response.body)

  def decide(token, decision, message = nil)
    post("/api/public/appointment_decisions/#{token}", params: { decision: decision, message: message }, as: :json)
  end

  let(:two_days) { [["2026-11-03", "09:00"], ["2026-11-04", "10:00"]] }

  before { book(two_days) }

  it "shows the request without changing it" do
    token = decide_token
    expect { get("/api/public/appointment_decisions/#{token}") }.not_to(change { Appointment.pluck(:status, :decided_at) })

    expect(response).to(have_http_status(:ok))
    expect(json["appointment"]).to(include("status" => "pending", "service" => "Haircut", "client_name" => "Ana", "client_email" => "ana@example.com", "expires_at" => (now + 60.minutes).iso8601))
    expect(json["appointment"]["sessions"].size).to(eq(2))
  end

  it "does not open with a manage link, nor does a decision link open the manage page" do
    manage = AppointmentToken.issue(booking: Appointment.first, expires_at: now + 30.days)
    get("/api/public/appointment_decisions/#{manage}")
    expect(response).to(have_http_status(:not_found))

    get("/api/public/appointments/#{decide_token}")
    expect(response).to(have_http_status(:not_found))
  end

  it "answers the same for an unknown or expired link" do
    get("/api/public/appointment_decisions/nope")
    unknown = response.body
    get("/api/public/appointment_decisions/#{decide_token(expires_at: now - 1.minute)}")

    expect(response).to(have_http_status(:not_found))
    expect(response.body).to(eq(unknown))
  end

  it "approves every session, confirms to the client and keeps the places" do
    token = decide_token
    deliveries.clear
    perform_enqueued_jobs { decide(token, "approve", "See you soon") }

    expect(json["result"]).to(eq("approve"))
    expect(Appointment.pluck(:status).uniq).to(eq(["confirmed"]))
    expect(Appointment.first).to(have_attributes(decided_by: "owner", decision_message: "See you soon", decided_at: now))
    expect(AppointmentSlot.sum(:booked)).to(eq(2))
    expect(deliveries.map(&:to)).to(eq([["ana@example.com"]]))
    expect(deliveries.last.subject).to(start_with("Confirmed: Haircut"))
  end

  it "declines, frees the places and tells the client with the owner's message" do
    token = decide_token
    deliveries.clear
    perform_enqueued_jobs { decide(token, "decline", "Closed that day") }

    expect(json["result"]).to(eq("decline"))
    expect(Appointment.pluck(:status).uniq).to(eq(["declined"]))
    expect(AppointmentSlot.sum(:booked)).to(eq(0))
    expect(deliveries.last.subject).to(start_with("Not confirmed: Haircut"))
    expect(deliveries.last.text_part.body.to_s).to(include("Closed that day"))
  end

  it "decides once: a second click or the other button changes nothing and sends nothing" do
    token = decide_token
    perform_enqueued_jobs { decide(token, "approve") }
    deliveries.clear
    perform_enqueued_jobs { decide(token, "approve") }
    perform_enqueued_jobs { decide(token, "decline") }

    expect(json["result"]).to(eq("already_decided"))
    expect(Appointment.pluck(:status).uniq).to(eq(["confirmed"]))
    expect(AppointmentSlot.sum(:booked)).to(eq(2))
    expect(deliveries).to(be_empty)
    expect(Notification.where(kind: ["appointment_confirmed", "appointment_declined"], recipient_kind: "client").count).to(eq(1))
  end

  it "refuses a decision after the deadline" do
    token = decide_token
    travel_to(now + 61.minutes)
    decide(token, "approve")

    expect(json["result"]).to(eq("expired"))
    expect(Appointment.pluck(:status).uniq).to(eq(["pending"]))
  end

  it "rejects an unknown decision" do
    decide(decide_token, "maybe")
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(Appointment.pluck(:status).uniq).to(eq(["pending"]))
  end

  it "puts a decision link in the owner's email" do
    deliveries.clear
    Notification.where(kind: "appointment_requested", channel: "email").each { |row| Notifications::Deliver.call(id: row.id) }

    expect(deliveries.last.text_part.body.to_s).to(match(%r{/a/[\w-]{40,}}))
  end
end
