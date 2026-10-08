require "rails_helper"

RSpec.describe("in-app notifications for a client with a Kurz account", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let!(:client) { FactoryBot.create(:user, email: "Cli@Example.com", verified_at: now) }
  let(:client_headers) { { "Authorization" => "Bearer #{SessionToken.issue(client)}" } }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 5, "days" => ["tue"], "times" => ["09:00"] } }
  let(:rules) { {} }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => rules })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def book(email)
    answers = { mail_id => email, booking_id => { "service" => service_id, "sessions" => [{ "date" => "2026-11-03", "time" => "09:00" }] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
    expect(response).to(have_http_status(:created))
  end

  def mirrored = Notification.in_app.where(recipient_kind: "client")

  it "puts the confirmation in the app of the verified account with that email, whatever its case" do
    book("cli@EXAMPLE.com")
    expect(json["email_delivery"]).to(eq("queued"))
    expect(mirrored.count).to(eq(1))
    expect(mirrored.first).to(have_attributes(user_id: client.id, recipient_email: "cli@EXAMPLE.com", kind: "appointment_confirmed", status: "sent", appointment_id: Appointment.last.id, read_at: nil))
    expect(mirrored.first.sent_at).to(be_present)
    expect(mirrored.first.payload).to(eq("group_key" => Appointment.last.group_key, "sessions" => 1))
    email = Notification.where(channel: "email", recipient_kind: "client")
    expect(email.count).to(eq(1))
    expect(email.first.payload).to(eq("form_id" => form.id, "response_id" => FormResponse.last.id, "group_key" => Appointment.last.group_key, "sessions" => 1))
  end

  it "never shows the client the owner's internal ids" do
    book("cli@example.com")
    appointment = Appointment.last
    Notification.queue_email(kind: "appointment_declined", event_key: "x", source: appointment, recipient_kind: "client", recipient_email: client.email, payload: { form_id: form.id, response_id: 9, cancelled_ids: [1], expires_at: "2026-11-03T09:00:00Z", group_key: "g" })

    get("/api/me/notifications", headers: client_headers)
    expect(json["notifications"].map { |row| row["payload"] }).to(eq([{ "group_key" => "g" }, { "group_key" => appointment.group_key, "sessions" => 1 }]))
    expect(response.body).not_to(include("form_id", "response_id", "cancelled_ids", "expires_at"))
  end

  it "leaves out an unverified account, a deactivated one and an email without account" do
    client.update!(verified_at: nil)
    book("cli@example.com")
    client.update!(verified_at: now, deactivated_at: now)
    book("cli@example.com")
    book("nobody@example.com")
    expect(mirrored).to(be_empty)
    expect(Notification.where(channel: "email", recipient_kind: "client").count).to(eq(3))
  end

  context "when the email must be verified" do
    let(:rules) { { "verify_email" => true } }

    it "never puts the verification code in the app" do
      book("cli@example.com")
      expect(Notification.where(kind: "appointment_verify").pluck(:channel)).to(eq(["email"]))
      expect(mirrored).to(be_empty)
    end
  end

  it "mirrors every client email but the verification, and never an owner email" do
    book("cli@example.com")
    appointment = Appointment.last
    kinds = ["appointment_request_received", "appointment_declined", "appointment_cancelled", "appointment_reminder", "appointment_rescheduled", "appointment_verify"]
    kinds.each { |kind| Notification.queue_email(kind: kind, event_key: "k-#{kind}", source: appointment, recipient_kind: "client", recipient_email: client.email, payload: { form_id: form.id }) }
    Notification.queue_email(kind: "appointment_cancelled", event_key: "owner", source: appointment, recipient_kind: "owner", user_id: client.id, payload: {})

    expect(mirrored.pluck(:kind)).to(match_array(["appointment_confirmed"] + kinds - ["appointment_verify"]))
    expect(Notification.in_app.where(recipient_kind: "owner", user_id: client.id)).to(be_empty)
  end

  it "keeps the owner's list and count to the owner's own notifications" do
    book("cli@example.com")

    get("/api/me/notifications", headers: auth_headers)
    expect(json["notifications"].map { |row| [row["kind"], row["recipient_kind"]] }).to(eq([["appointment_created", "owner"]]))
    expect(json["unread_count"]).to(eq(1))

    post("/api/me/notifications/#{mirrored.first.id}/read", headers: auth_headers)
    expect(response).to(have_http_status(:not_found))
    post("/api/me/notifications/read_all", headers: auth_headers)
    expect(mirrored.first.read_at).to(be_nil)
  end

  it "shows the client their own notifications as a client and lets them read them" do
    book("cli@example.com")

    get("/api/me/notifications", headers: client_headers)
    expect(json["notifications"].size).to(eq(1))
    expect(json["notifications"].first).to(include("kind" => "appointment_confirmed", "recipient_kind" => "client", "read_at" => nil))
    expect(json["unread_count"]).to(eq(1))

    post("/api/me/notifications/#{mirrored.first.id}/read", headers: client_headers)
    expect(response).to(have_http_status(:ok))
    expect(json["unread_count"]).to(eq(0))
  end

  it "lists both sides for an owner who books their own form" do
    current_user.update!(verified_at: now)
    book(current_user.email)

    get("/api/me/notifications", headers: auth_headers)
    expect(json["notifications"].map { |row| [row["kind"], row["recipient_kind"]] }).to(eq([["appointment_confirmed", "client"], ["appointment_created", "owner"]]))
    expect(json["unread_count"]).to(eq(2))
  end
end
