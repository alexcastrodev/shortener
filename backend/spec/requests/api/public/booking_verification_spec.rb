require "rails_helper"

RSpec.describe("email verification in automatic mode", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"] } }
  let(:rules) { { "approval" => "auto", "verify_email" => true } }
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
    allow(ENV).to(receive(:fetch).and_call_original)
    allow(ENV).to(receive(:fetch).with("FRONTEND_URL", anything).and_return("https://kurz.test"))
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => rules })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def book(name: "Ana", date: "2026-11-03", time: "09:00", locale: "en")
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => [{ "date" => date, "time" => time }] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", client_locale: locale }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def row = Appointment.order(:id).last

  def verify_link
    mail = deliveries.find { |item| item.subject.to_s.include?("Confirm your booking") || item.subject.to_s.include?("Confirme") }
    mail.text_part.body.to_s[%r{https://kurz.test/v/([\w-]+)}, 1]
  end

  def slot_booked = AppointmentSlot.sum(:booked)

  describe "booking" do
    it "holds the place for fifteen minutes and tells nobody but the client" do
      perform_enqueued_jobs { book }
      expect(response).to(have_http_status(:created))
      expect(row).to(have_attributes(status: "unverified", expires_at: now + 15.minutes))
      expect(slot_booked).to(eq(1))
      expect(Notification.where(recipient_kind: "owner")).to(be_empty)
      expect(Notification.pluck(:kind)).to(eq(["appointment_verify"]))
      expect(deliveries.size).to(eq(1))
      expect(deliveries.first.to).to(eq(["ana@example.com"]))
      expect(verify_link.length).to(be >= 43)
    end

    it "keeps the place taken for others while it waits" do
      book
      book(name: "Bo")
      expect(response).to(have_http_status(:unprocessable_content))
      expect(slot_booked).to(eq(1))
    end

    it "does not ask when the form does not want it, or when approval is manual" do
      Forms::Definition.update(form, booking_id, { "rules" => { "verify_email" => false } })
      Forms::Publish.call(form: form.reload)
      book
      expect(row.status).to(eq("confirmed"))
      Forms::Definition.update(form, booking_id, { "rules" => { "verify_email" => true, "approval" => "manual" } })
      Forms::Publish.call(form: form.reload)
      book(name: "Bo", time: "10:00")
      expect(row.status).to(eq("pending"))
    end
  end

  describe "the link" do
    before { perform_enqueued_jobs { book } }

    it "shows the booking without changing it" do
      get("/api/public/appointment_verifications/#{verify_link}")
      expect(response).to(have_http_status(:ok))
      expect(json["appointment"]).to(include("status" => "unverified", "service" => "Haircut"))
      expect(json["appointment"].keys).not_to(include("client_email", "client_name"))
      expect(row.status).to(eq("unverified"))
    end

    it "confirms the booking, tells the owner and sends the confirmation" do
      token = verify_link
      deliveries.clear
      perform_enqueued_jobs { post("/api/public/appointment_verifications/#{token}", as: :json) }
      expect(response).to(have_http_status(:ok))
      expect(json["result"]).to(eq("verified"))
      expect(row).to(have_attributes(status: "confirmed", expires_at: nil))
      expect(Notification.where(kind: "appointment_created", recipient_kind: "owner").count).to(be >= 1)
      expect(deliveries.map(&:to).flatten).to(include("ana@example.com", current_user.email))
    end

    it "does it once: a second click changes nothing and sends nothing" do
      token = verify_link
      post("/api/public/appointment_verifications/#{token}", as: :json)
      count = Notification.count
      post("/api/public/appointment_verifications/#{token}", as: :json)
      expect(json["result"]).to(eq("already_done"))
      expect(Notification.count).to(eq(count))
    end

    it "refuses it after the fifteen minutes, even before the sweep" do
      token = verify_link
      travel_to(now + 16.minutes)
      post("/api/public/appointment_verifications/#{token}", as: :json)
      expect(json["result"]).to(eq("expired"))
      expect(row.status).to(eq("unverified"))
    end

    it "answers a wrong, a manage or a decision link like an unknown one" do
      get("/api/public/appointment_verifications/nope")
      unknown = [response.status, response.body]
      expect(unknown.first).to(eq(404))
      manage = AppointmentToken.issue(booking: row, expires_at: now + 1.day)
      decide = AppointmentToken.issue(booking: row, expires_at: now + 1.day, purpose: "decide")
      [manage, decide, "#{verify_link}x"].each do |guess|
        get("/api/public/appointment_verifications/#{guess}")
        expect([response.status, response.body]).to(eq(unknown))
      end
      get("/api/public/appointments/#{verify_link}")
      expect(response).to(have_http_status(:not_found))
    end

    it "limits the clicks per address" do
      20.times { post("/api/public/appointment_verifications/nope", headers: { "CF-Connecting-IP" => "203.0.113.31" }, as: :json) }
      post("/api/public/appointment_verifications/nope", headers: { "CF-Connecting-IP" => "203.0.113.31" }, as: :json)
      expect(response).to(have_http_status(:too_many_requests))
    end
  end

  describe "when nobody clicks" do
    before { perform_enqueued_jobs { book } }

    it "releases the place after fifteen minutes and says nothing to the owner" do
      expect(Appointments::ResolveExpired.call(now: now + 14.minutes)).to(eq(0))
      expect(row.status).to(eq("unverified"))
      expect(Appointments::ResolveExpired.call(now: now + 16.minutes)).to(eq(1))
      expect(row).to(have_attributes(status: "expired", decided_by: "timeout"))
      expect(slot_booked).to(eq(0))
      expect(Notification.where(recipient_kind: "owner")).to(be_empty)
      book(name: "Bo")
      expect(response).to(have_http_status(:created))
    end

    it "does not email a verification that is no longer needed" do
      Appointments::ResolveExpired.call(now: now + 16.minutes)
      notification = Notification.find_by(kind: "appointment_verify")
      notification.update_columns(status: "pending", next_attempt_at: now)
      deliveries.clear
      Notifications::Deliver.call(id: notification.id)
      expect(deliveries).to(be_empty)
      expect(notification.reload).to(have_attributes(status: "failed", last_error: "not_unverified"))
    end

    it "lets the client cancel while it waits, which frees the place" do
      token = AppointmentToken.issue(booking: row, expires_at: now + 1.day)
      post("/api/public/appointments/#{token}/cancel", as: :json)
      expect(response).to(have_http_status(:ok))
      expect(slot_booked).to(eq(0))
    end
  end

  describe "setting it" do
    def update(rules)
      patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { rules: rules }, headers: auth_headers, as: :json)
    end

    it "takes true, false and nothing, and refuses anything else" do
      [true, false, nil].each do |value|
        update(verify_email: value)
        expect(response).to(have_http_status(:ok), value.inspect)
      end
      ["maybe", [], {}].each do |value|
        update(verify_email: value)
        expect(response).to(have_http_status(:unprocessable_content), value.inspect)
      end
    end
  end
end
