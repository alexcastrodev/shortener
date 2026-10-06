require "rails_helper"

RSpec.describe("/api/me/notification_preferences", type: :request) do
  include_context "authenticated user"

  let(:other) { FactoryBot.create(:user) }
  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => nil, "days" => ["tue", "wed"], "times" => ["09:00", "10:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
    travel_to(now)
  end

  def json = JSON.parse(response.body)

  def show(headers: auth_headers)
    get("/api/me/notification_preferences", headers: headers)
  end

  def change(list, headers: auth_headers)
    put("/api/me/notification_preferences", params: { preferences: list }, headers: headers, as: :json)
  end

  def cell(kind, channel)
    json["preferences"].find { |item| item["kind"] == kind && item["channel"] == channel }
  end

  def book_appointment
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service] }) if form.reload.fields.empty?
    if form.reload.fields.size == 1
      Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
      Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
      Forms::Publish.call(form: form.reload)
    end
    answers = { name_id => "Ana", mail_id => "ana@example.com", booking_id => { "service" => service_id, "sessions" => [{ "date" => "2026-11-03", "time" => "09:00" }] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
    expect(response).to(have_http_status(:created))
  end

  def owner_bell = Notification.where(channel: "in_app", user_id: current_user.id).count
  def owner_mail = Notification.where(channel: "email", recipient_kind: "owner", user_id: current_user.id).count
  def client_mail = Notification.where(channel: "email", recipient_kind: "client").count

  describe "access" do
    it "answers 401 without a token and 404 when the feature is off" do
      get("/api/me/notification_preferences")
      expect(response).to(have_http_status(:unauthorized))
      put("/api/me/notification_preferences", params: { preferences: [] }, as: :json)
      expect(response).to(have_http_status(:unauthorized))
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      show
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "the matrix" do
    it "has every event and channel, everything that can be sent starts on" do
      show
      expect(response).to(have_http_status(:ok))
      expect(json["preferences"].size).to(eq(15))
      expect(cell("appointment_created", "email")).to(eq("kind" => "appointment_created", "channel" => "email", "supported" => true, "enabled" => true))
      expect(cell("appointment_cancelled", "email")).to(include("supported" => false, "enabled" => false))
      expect(cell("appointment_created", "push")).to(include("supported" => false, "enabled" => false))
    end

    it "saves a change and shows it, leaving the rest alone" do
      change([{ kind: "appointment_created", channel: "email", enabled: false }])
      expect(response).to(have_http_status(:ok))
      expect(cell("appointment_created", "email")["enabled"]).to(be(false))
      expect(cell("appointment_created", "in_app")["enabled"]).to(be(true))
      expect(cell("appointment_requested", "email")["enabled"]).to(be(true))
    end

    it "turns a channel back on" do
      change([{ kind: "appointment_created", channel: "email", enabled: false }])
      change([{ kind: "appointment_created", channel: "email", enabled: true }])
      expect(cell("appointment_created", "email")["enabled"]).to(be(true))
      expect(NotificationPreference.count).to(eq(1))
    end

    it "is per user" do
      change([{ kind: "appointment_created", channel: "in_app", enabled: false }])
      show(headers: { "Authorization" => "Bearer #{SessionToken.issue(other)}" })
      expect(cell("appointment_created", "in_app")["enabled"]).to(be(true))
    end

    it "refuses unknown events, unknown channels, channels with no sender and non-boolean values, applying none of them" do
      [
        { kind: "appointment_nope", channel: "email", enabled: false },
        { kind: "appointment_created", channel: "sms", enabled: false },
        { kind: "appointment_cancelled", channel: "email", enabled: false },
        { kind: "appointment_created", channel: "push", enabled: false },
        { kind: "appointment_created", channel: "email", enabled: "no" },
      ].each do |bad|
        change([{ kind: "appointment_created", channel: "in_app", enabled: false }, bad])
        expect(response).to(have_http_status(:unprocessable_entity), bad.inspect)
      end
      expect(NotificationPreference.count).to(eq(0))
    end

    it "refuses something that is not a list" do
      put("/api/me/notification_preferences", params: { preferences: "all" }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:unprocessable_entity))
    end
  end

  describe "what the owner receives" do
    it "sends the bell and the email by default" do
      book_appointment
      expect([owner_bell, owner_mail]).to(eq([1, 1]))
    end

    it "skips the email but keeps the bell when the email is off" do
      change([{ kind: "appointment_created", channel: "email", enabled: false }])
      book_appointment
      expect([owner_bell, owner_mail]).to(eq([1, 0]))
    end

    it "skips the bell but keeps the email when the bell is off" do
      change([{ kind: "appointment_created", channel: "in_app", enabled: false }])
      book_appointment
      expect([owner_bell, owner_mail]).to(eq([0, 1]))
      get("/api/me/notifications", headers: auth_headers)
      expect(json["notifications"]).to(eq([]))
    end

    it "can silence both, and the booking still succeeds and the client is still told" do
      change([{ kind: "appointment_created", channel: "email", enabled: false }, { kind: "appointment_created", channel: "in_app", enabled: false }])
      book_appointment
      expect([owner_bell, owner_mail]).to(eq([0, 0]))
      expect(client_mail).to(eq(1))
      expect(Appointment.count).to(eq(1))
    end

    it "only silences the event that was chosen" do
      change([{ kind: "appointment_requested", channel: "email", enabled: false }])
      book_appointment
      expect(owner_mail).to(eq(1))
    end
  end

  it "removes the preferences with the account" do
    NotificationPreference.create!(user: other, kind: "appointment_created", channel: "email", enabled: false)
    other.destroy!
    expect(NotificationPreference.count).to(eq(0))
  end
end
