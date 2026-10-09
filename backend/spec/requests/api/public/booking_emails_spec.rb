require "rails_helper"

RSpec.describe("emails for a booking", type: :request) do
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

  def book(extra: {}, name: "Ana")
    body = {
      answers: { name_id => name, mail_id => "ana@example.com", booking_id => { "service" => service_id, "sessions" => [{ "date" => "2026-11-03", "time" => "09:00" }] } },
      turnstile_token: "t",
      confirm_field_id: mail_id,
    }.merge(extra)
    post("/api/public/forms/#{form.public_id}/responses", params: body, headers: { "CF-Connecting-IP" => "198.51.100.7" }, as: :json)
  end

  def emails
    Notification.where(channel: "email").order(:id)
  end

  def deliver_all
    emails.pluck(:id).each { |id| Notifications::Deliver.call(id: id) }
  end

  describe "queueing" do
    it "writes one email for the owner and one for the client with the booking, carrying only ids" do
      expect { book }.to(have_enqueued_job(NotificationDeliveryJob).exactly(2).times)

      expect(emails.pluck(:kind, :recipient_kind, :status)).to(eq([["appointment_created", "owner", "pending"], ["appointment_confirmed", "client", "pending"]]))
      expect(emails.first.user_id).to(eq(current_user.id))
      expect(emails.last.recipient_email).to(eq("ana@example.com"))
      expect(emails.map { |row| row.payload.keys }.flatten.uniq).to(match_array(["form_id", "response_id", "group_key", "sessions"]))
    end

    it "queues nothing when the booking is refused" do
      book(extra: { answers: {} })
      expect(emails.count).to(eq(0))
    end
  end

  describe "delivery" do
    it "sends the client a confirmation that replies to the owner, and tells the owner" do
      perform_enqueued_jobs { book }

      expect(deliveries.size).to(eq(2))
      client = deliveries.find { |mail| mail.to == ["ana@example.com"] }
      owner = deliveries.find { |mail| mail.to == [current_user.email] }
      expect(client.subject).to(eq("Confirmed: Haircut · Tue 3 Nov, 09:00"))
      expect(client.reply_to).to(eq([current_user.email]))
      expect(client.text_part.body.decoded).to(include("Service: Haircut\nWith: Salon\nWhen:\n- Tuesday 3 November · 09:00–10:00\n  Time zone: UTC\nTotal: €25.00"))
      expect(owner.subject).to(eq("New booking: Haircut · Ana · Tue 3 Nov, 09:00"))
      expect(owner.text_part.body.decoded).to(include("Ana booked Haircut.", "Client: Ana · ana@example.com"))
      expect(emails.pluck(:status)).to(eq(["sent", "sent"]))
      expect(emails.map(&:attempts)).to(eq([1, 1]))
    end

    it "writes each mail in the language and time zone of who reads it" do
      current_user.update!(locale: "pt-PT", time_zone: "America/Sao_Paulo")
      perform_enqueued_jobs { book(extra: { client_locale: "pt-PT", client_time_zone: "Europe/Lisbon" }) }

      expect(deliveries.find { |mail| mail.to == ["ana@example.com"] }.subject).to(eq("Confirmada: Haircut · ter, 3 nov, 09:00"))
      owner = deliveries.find { |mail| mail.to == [current_user.email] }
      expect(owner.subject).to(eq("Nova marcação: Haircut · Ana · ter, 3 nov, 06:00"))
      expect(owner.text_part.body.decoded).to(include("- terça-feira, 3 de novembro · 06:00–07:00\n  Fuso horário: America/Sao Paulo"))
    end

    it "sends each notification once, however many times it is picked up" do
      book
      2.times { deliver_all }

      expect(deliveries.size).to(eq(2))
      expect(emails.pluck(:attempts)).to(eq([1, 1]))
    end

    it "keeps a customer's name out of the headers" do
      book
      Appointment.update_all(client_name: "Ana\r\nBcc: evil@example.com")
      deliver_all

      owner = deliveries.find { |mail| mail.to == [current_user.email] }
      expect(owner.subject).to(eq("New booking: Haircut · Ana Bcc: evil@example.com · Tue 3 Nov, 09:00"))
      expect(owner.bcc).to(be_nil)
    end

    it "fails a row whose appointment is gone instead of retrying it forever" do
      book
      emails.update_all(appointment_id: nil)
      deliver_all

      expect(emails.pluck(:status, :last_error).uniq).to(eq([["failed", "unsupported"]]))
      expect(deliveries).to(be_empty)
    end
  end

  describe "the email budget" do
    let(:refusal) { MailBudget::Result.new(ok: false, reason: :daily_limit) }

    it "sends under a lower priority than sign-in codes" do
      book
      expect(MailBudget).to(receive(:reserve).with(new_address: false, share: 0.8).twice.and_return(MailBudget::Result.new(ok: true, reason: nil)))
      deliver_all
    end

    it "keeps the booking and the in-app notification, and tries again in five minutes" do
      allow(MailBudget).to(receive(:reserve).and_return(refusal))
      book
      deliver_all

      expect(response).to(have_http_status(:created))
      expect(Notification.in_app.count).to(eq(1))
      expect(emails.pluck(:status, :attempts, :last_error).uniq).to(eq([["pending", 1, "budget:daily_limit"]]))
      expect(emails.first.next_attempt_at).to(be_within(1.second).of(now + 5.minutes))
      expect(deliveries).to(be_empty)
    end

    it "sends the email once the budget allows it again" do
      allow(MailBudget).to(receive(:reserve).and_return(refusal))
      book
      deliver_all
      allow(MailBudget).to(receive(:reserve).and_return(MailBudget::Result.new(ok: true, reason: nil)))

      travel_to(now + 6.minutes)
      deliver_all
      expect(deliveries.size).to(eq(2))
      expect(emails.pluck(:status).uniq).to(eq(["sent"]))
    end

    it "gives up after a day" do
      allow(MailBudget).to(receive(:reserve).and_return(refusal))
      book
      travel_to(now + 25.hours)
      deliver_all

      expect(emails.pluck(:status, :last_error).uniq).to(eq([["failed", "budget:daily_limit"]]))
    end

    it "retries a transient provider failure and does not touch the other emails" do
      book
      calls = 0
      allow_any_instance_of(ActionMailer::MessageDelivery).to(receive(:deliver_now)) do
        calls += 1
        raise Net::ReadTimeout if calls == 1

        true
      end
      deliver_all

      expect(emails.pluck(:status)).to(eq(["pending", "sent"]))
      expect(emails.first.last_error).to(eq("Net::ReadTimeout"))
    end
  end

  describe DispatchNotificationsJob do
    it "picks up the pending emails that are due, and only those" do
      book
      emails.first.update!(next_attempt_at: now + 1.hour)
      emails.last.update!(status: "sent")
      Notification.create!(channel: "email", kind: "appointment_created", recipient_kind: "owner", user_id: current_user.id, event_key: "other", status: "pending", next_attempt_at: now - 1.minute)

      expect { described_class.perform_now }.to(have_enqueued_job(NotificationDeliveryJob).exactly(1).times)
    end
  end

  describe "manual approval" do
    before do
      Forms::Definition.update(form.reload, form.fields.first["id"], { "rules" => { "approval" => "manual", "approval_timeout_minutes" => 60 } })
      Forms::Publish.call(form: form.reload)
    end

    it "writes the owner's request with the deadline and the client's receipt with a manage link" do
      book(extra: { client_locale: "pt-PT" })
      deliveries.clear
      deliver_all

      owner_mail = deliveries.find { |mail| mail.to == [current_user.email] }
      client_mail = deliveries.find { |mail| mail.to == ["ana@example.com"] }
      expect(owner_mail.subject).to(start_with("Booking to approve: Haircut"))
      expect(owner_mail.text_part.body.to_s).to(include("Without an answer by Monday 2 November at 09:00, the request is declined", "Approve or decline:\nhttps://kurz.fyi/a/"))
      expect(client_mail.subject).to(start_with("Pedido recebido: Haircut"))
      expect(client_mail.text_part.body.to_s).to(include("/m/"))
    end
  end
end
