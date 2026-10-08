require "rails_helper"

RSpec.describe("the owner's email when a client cancels", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 2, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"] } }
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
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => { "approval" => "auto" } })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def book(name: "Ana", times: [["2026-11-03", "09:00"], ["2026-11-04", "10:00"]])
    sessions = times.map { |date, time| { "date" => date, "time" => time } }
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => sessions } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_locale: "en" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def cancel(params = {})
    token = AppointmentToken.issue(booking: Appointment.order(:id).first, expires_at: now + 30.days)
    post("/api/public/appointments/#{token}/cancel", params: params, as: :json)
  end

  def owner_mail = deliveries.find { |mail| mail.to == [current_user.email] && mail.subject.to_s.include?("cancelled") }

  it "emails the owner who cancelled, which sessions, why, and where to look" do
    book
    deliveries.clear
    perform_enqueued_jobs { cancel(reason: "Sick today") }
    mail = owner_mail
    expect(mail).to(be_present)
    expect(mail.subject).to(eq("Booking cancelled: Haircut, Ana"))
    text = mail.text_part.body.to_s
    expect(text).to(include("Ana cancelled Haircut", "Reason: Sick today", "ana@example.com"))
    expect(text.scan(/^- /).size).to(eq(2))
    expect(deliveries.find { |item| item.to == ["ana@example.com"] }).to(be_present)
  end

  it "lists only the sessions that were cancelled when a client cancels part of a booking" do
    book
    deliveries.clear
    row = Appointment.joins(:slot).order("appointment_slots.starts_at").last
    perform_enqueued_jobs { cancel(scope: "one", session: row.slot.starts_at.iso8601) }
    expect(owner_mail.text_part.body.to_s.scan(/^- /).size).to(eq(1))
  end

  it "says it in the owner's language and keeps a name with line breaks out of the subject" do
    current_user.update!(locale: "pt-PT")
    book
    Appointment.update_all(client_name: "Ana\r\nBcc: evil@example.com")
    deliveries.clear
    perform_enqueued_jobs { cancel }
    mail = deliveries.find { |item| item.to == [current_user.email] }
    expect(mail.subject).to(start_with("Marcação cancelada"))
    expect(mail.subject).not_to(match(/[\r\n]/))
    expect(mail.header.fields.map(&:name)).not_to(include("Bcc"))
  end

  it "is not sent when the owner turned the email off for cancellations" do
    book
    patch("/api/me/notification_preferences", params: { preferences: [{ kind: "appointment_cancelled", channel: "email", enabled: false }] }, headers: auth_headers, as: :json)
    deliveries.clear
    perform_enqueued_jobs { cancel }
    expect(owner_mail).to(be_nil)
    expect(deliveries.find { |item| item.to == ["ana@example.com"] }).to(be_present)
    expect(Notification.where(kind: "appointment_cancelled", recipient_kind: "owner", channel: "in_app").count).to(eq(1))
  end

  it "is not sent when the owner is the one who cancels, who knows already" do
    book
    row = Appointment.order(:id).first
    post("/api/me/appointments/#{row.id}/cancel", headers: auth_headers, as: :json)
    expect(Notification.where(kind: "appointment_cancelled", recipient_kind: "owner")).to(be_empty)
  end

  it "does not send it twice for the same cancellation" do
    book
    cancel
    count = Notification.where(kind: "appointment_cancelled", recipient_kind: "owner", channel: "email").count
    cancel
    expect(count).to(eq(1))
    expect(Notification.where(kind: "appointment_cancelled", recipient_kind: "owner", channel: "email").count).to(eq(1))
  end
end
