require "rails_helper"

RSpec.describe("managing a booking from its link", type: :request) do
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

  def book(list, name: "Ana", ip: "198.51.100.7")
    sessions = list.map { |date, time| { "date" => date, "time" => time } }
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => sessions } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", client_time_zone: "Europe/Lisbon" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  def token_for(appointment, expires_at: now + 30.days)
    AppointmentToken.issue(booking: appointment, expires_at: expires_at)
  end

  def json = JSON.parse(response.body)

  def cancel(token, params = {})
    post("/api/public/appointments/#{token}/cancel", params: params, as: :json)
  end

  let(:two_days) { [["2026-11-03", "09:00"], ["2026-11-04", "10:00"]] }

  describe AppointmentToken do
    it "keeps only the digest of the link, and a link opens only its own booking" do
      book(two_days)
      appointment = Appointment.order(:id).first
      token = token_for(appointment)

      expect(AppointmentToken.last.digest).to(eq(Digest::SHA256.hexdigest(token)))
      expect(AppointmentToken.last.attributes.values.map(&:to_s)).not_to(include(token))
      expect(described_class.resolve(token)).to(eq(appointment))
      expect(described_class.resolve("#{token}x")).to(be_nil)
      expect(described_class.resolve(nil)).to(be_nil)
    end
  end

  describe "GET /api/public/appointments/:token" do
    it "shows the whole booking, in the order of the sessions" do
      book(two_days)
      get("/api/public/appointments/#{token_for(Appointment.order(:id).last)}")

      expect(response).to(have_http_status(:ok))
      expect(json["appointment"]).to(include("form_title" => "Salon", "service" => "Haircut", "status" => "confirmed", "cancellable" => true, "time_zone" => "Europe/Lisbon"))
      expect(json["appointment"]["sessions"]).to(eq([{ "starts_at" => "2026-11-03T09:00:00Z", "status" => "confirmed" }, { "starts_at" => "2026-11-04T10:00:00Z", "status" => "confirmed" }]))
    end
  end

  describe "POST /api/public/appointments/:token/cancel" do
    it "cancels every session, frees the places, keeps the reason and tells the owner and the client" do
      book(two_days)
      token = token_for(Appointment.order(:id).first)
      deliveries.clear

      expect { cancel(token, reason: "  Sick today  ") }.to(have_enqueued_job(NotificationDeliveryJob).exactly(2).times)

      expect(response).to(have_http_status(:ok))
      expect(json["appointment"]).to(include("status" => "cancelled", "cancellable" => false))
      expect(Appointment.order(:id).pluck(:status, :cancelled_by, :cancel_reason).uniq).to(eq([["cancelled", "client", "Sick today"]]))
      expect(AppointmentSlot.pluck(:booked).uniq).to(eq([0]))
      expect(Notification.in_app.order(:id).last).to(have_attributes(kind: "appointment_cancelled", user_id: current_user.id, payload: hash_including("sessions" => 2)))
      cancelled_mail = Notification.where(channel: "email", kind: "appointment_cancelled")
      expect(cancelled_mail.pluck(:recipient_kind, :recipient_email, :status)).to(match_array([["client", "ana@example.com", "pending"], ["owner", nil, "pending"]]))
    end

    it "frees the place for someone else" do
      book([["2026-11-03", "09:00"]])
      cancel(token_for(Appointment.last))
      book([["2026-11-03", "09:00"]], name: "Rui", ip: "198.51.100.8")

      expect(response).to(have_http_status(:created))
    end

    it "does nothing the second time, notifies once and does not free the place twice" do
      book([["2026-11-03", "09:00"]])
      token = token_for(Appointment.last)
      cancel(token)
      cancel(token)

      expect(response).to(have_http_status(:ok))
      expect(Notification.where(kind: "appointment_cancelled").count).to(eq(3))
      expect(AppointmentSlot.pluck(:booked)).to(eq([0]))
    end

    it "leaves a session that already started alone" do
      book(two_days)
      travel_to(Time.utc(2026, 11, 3, 12, 0))
      cancel(token_for(Appointment.order(:id).first, expires_at: Time.utc(2026, 12, 1)))

      expect(Appointment.order(:id).pluck(:status)).to(eq(["confirmed", "cancelled"]))
    end

    it "caps the reason" do
      book([["2026-11-03", "09:00"]])
      cancel(token_for(Appointment.last), reason: "x" * 900)

      expect(Appointment.last.cancel_reason.size).to(eq(Appointments::ClientCancel::REASON_MAX))
    end

    it "refuses a link that is not valid, and one from another booking cannot reach this one" do
      book([["2026-11-03", "09:00"]])
      book([["2026-11-03", "10:00"]], name: "Rui", ip: "198.51.100.8")
      ana, rui = Appointment.order(:id).to_a
      cancel(token_for(rui))

      expect(Appointment.find(rui.id).status).to(eq("cancelled"))
      expect(Appointment.find(ana.id).status).to(eq("confirmed"))
      cancel("bogus")
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "the emails" do
    it "puts a working link to the booking in the confirmation and sends the cancellation" do
      perform_enqueued_jobs { book([["2026-11-03", "09:00"]]) }

      confirmation = deliveries.find { |mail| mail.to == ["ana@example.com"] }
      link = confirmation.text_part.body.decoded[%r{https://kurz\.fyi/m/([\w-]+)}, 1]
      expect(link).to(be_present)
      expect(AppointmentToken.resolve(link)).to(eq(Appointment.last))
      expect(confirmation.html_part.body.decoded).to(include("/m/#{link}"))

      deliveries.clear
      perform_enqueued_jobs { cancel(link) }
      mail = deliveries.last
      expect([mail.to, mail.reply_to, mail.subject]).to(eq([["ana@example.com"], [current_user.email], "Cancelled: Haircut, 2026-11-03 09:00 (Europe/Lisbon)"]))
    end
  end
end
