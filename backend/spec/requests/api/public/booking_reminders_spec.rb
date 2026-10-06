require "rails_helper"

RSpec.describe("reminders for a booking", type: :request) do
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
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => {} })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def book(date: "2026-11-03", name: "Ana", extra: {})
    body = {
      answers: { name_id => name, mail_id => "ana@example.com", booking_id => { "service" => service_id, "sessions" => [{ "date" => date, "time" => "09:00" }] } },
      turnstile_token: "t",
    }.merge(extra)
    post("/api/public/forms/#{form.public_id}/responses", params: body, headers: { "CF-Connecting-IP" => "198.51.100.7" }, as: :json)
  end

  def reminders
    Notification.where(kind: "appointment_reminder").order(:id)
  end

  describe Appointments::SendReminders do
    it "queues one reminder for the client once the visit is a day away, and only once" do
      book
      expect(described_class.call(now: Time.utc(2026, 11, 2, 8, 59))).to(eq(0))

      expect(described_class.call(now: Time.utc(2026, 11, 2, 9, 5))).to(eq(1))
      expect(described_class.call(now: Time.utc(2026, 11, 2, 9, 10))).to(eq(0))

      expect(reminders.pluck(:recipient_kind, :recipient_email, :status)).to(eq([["client", "ana@example.com", "pending"]]))
      expect(Appointment.last.reminder_sent_at).to(be_present)
    end

    it "sends no reminder for a booking made inside the last day, nor after the visit" do
      travel_to(Time.utc(2026, 11, 3, 6))
      book(date: "2026-11-03")
      travel_to(Time.utc(2026, 11, 2, 8))
      Appointment.update_all(created_at: Time.utc(2026, 11, 3, 6))

      expect(described_class.call(now: Time.utc(2026, 11, 3, 7))).to(eq(0))
      expect(described_class.call(now: Time.utc(2026, 11, 3, 10))).to(eq(0))
      expect(reminders).to(be_empty)
    end

    it "skips a cancelled booking" do
      book
      Appointment.update_all(status: "cancelled")

      expect(described_class.call(now: Time.utc(2026, 11, 2, 9, 5))).to(eq(0))
    end
  end

  describe "delivery" do
    it "emails the reminder in the client's language with a manage link" do
      book(extra: { client_locale: "pt-PT", client_time_zone: "Europe/Lisbon" })
      Appointments::SendReminders.call(now: Time.utc(2026, 11, 2, 9, 5))
      deliveries.clear
      Notifications::Deliver.call(id: reminders.last.id)

      mail = deliveries.last
      expect(mail.to).to(eq(["ana@example.com"]))
      expect(mail.subject).to(start_with("Lembrete: Haircut"))
      expect(mail.text_part.body.to_s).to(include("/m/"))
      expect(reminders.last.status).to(eq("sent"))
    end

    it "does not send a reminder for a booking cancelled after it was queued" do
      book
      Appointments::SendReminders.call(now: Time.utc(2026, 11, 2, 9, 5))
      Appointment.update_all(status: "cancelled")
      deliveries.clear
      Notifications::Deliver.call(id: reminders.last.id)

      expect(deliveries).to(be_empty)
      expect(reminders.last).to(have_attributes(status: "failed", last_error: "not_confirmed"))
    end

    it "stops earlier than other appointment emails when the budget runs low" do
      book
      Appointments::SendReminders.call(now: Time.utc(2026, 11, 2, 9, 5))
      allow(MailBudget).to(receive(:reserve).and_call_original)
      Notifications::Deliver.call(id: reminders.last.id)

      expect(MailBudget).to(have_received(:reserve).with(new_address: false, share: 0.5))
    end
  end
end
