require "rails_helper"

RSpec.describe("/api/me/notifications", type: :request) do
  include_context "authenticated user"

  let(:other) { FactoryBot.create(:user) }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
  end

  def json
    JSON.parse(response.body)
  end

  def make(user: current_user, key: SecureRandom.hex(4), **attrs)
    Notification.notify_owner(user_id: user.id, kind: "appointment_created", event_key: key, source: nil, payload: { form_id: 1 }).tap { |row| row.update!(attrs) if attrs.any? }
  end

  describe "listing" do
    it "answers 401 without a token on every route" do
      row = make
      [[:get, "/api/me/notifications"], [:post, "/api/me/notifications/read_all"], [:post, "/api/me/notifications/#{row.id}/read"]].each do |verb, path|
        send(verb, path)
        expect(response).to(have_http_status(:unauthorized), "#{verb} #{path}")
      end
    end

    it "answers 404 when the feature is off" do
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      get("/api/me/notifications", headers: auth_headers)
      expect(response).to(have_http_status(:not_found))
    end

    it "lists only my notifications, newest first, with the unread count" do
      first = make
      second = make
      make(user: other)
      second.update!(read_at: Time.current)

      get("/api/me/notifications", headers: auth_headers)

      expect(response).to(have_http_status(:ok))
      expect(json["notifications"].map { |row| row["id"] }).to(eq([second.id, first.id]))
      expect(json["unread_count"]).to(eq(1))
      expect(json["notifications"].first.keys).to(match_array(["id", "kind", "payload", "read_at", "created_at"]))
    end

    it "never lists notifications of other channels or recipients" do
      make
      Notification.create!(channel: "email", kind: "appointment_created", recipient_kind: "client", recipient_email: "c@example.com", event_key: "x", payload: {})
      get("/api/me/notifications", headers: auth_headers)
      expect(json["notifications"].size).to(eq(1))
    end

    it "pages with a cursor" do
      ids = Array.new(32) { make.id }
      get("/api/me/notifications", headers: auth_headers)
      expect(json["notifications"].size).to(eq(30))
      expect(json["next_before"]).to(eq(ids[2]))

      get("/api/me/notifications", params: { before: json["next_before"] }, headers: auth_headers)
      expect(json["notifications"].map { |row| row["id"] }).to(eq([ids[1], ids[0]]))
      expect(json["next_before"]).to(be_nil)
    end
  end

  describe "marking as read" do
    it "marks one notification and keeps the first read time on a repeat" do
      row = make
      post("/api/me/notifications/#{row.id}/read", headers: auth_headers)
      expect(response).to(have_http_status(:ok))
      expect(json["unread_count"]).to(eq(0))
      first = row.reload.read_at
      expect(first).to(be_present)

      travel_to(1.hour.from_now) { post("/api/me/notifications/#{row.id}/read", headers: auth_headers) }
      expect(row.reload.read_at).to(eq(first))
    end

    it "marks all of mine and leaves other people's alone" do
      mine = [make, make]
      theirs = make(user: other)
      post("/api/me/notifications/read_all", headers: auth_headers)
      expect(response).to(have_http_status(:ok))
      expect(json["unread_count"]).to(eq(0))
      expect(mine.map { |row| row.reload.read_at }).to(all(be_present))
      expect(theirs.reload.read_at).to(be_nil)
    end

    it "answers 404 for someone else's notification and changes nothing" do
      theirs = make(user: other)
      post("/api/me/notifications/#{theirs.id}/read", headers: auth_headers)
      expect(response).to(have_http_status(:not_found))
      post("/api/me/notifications/0/read", headers: auth_headers)
      expect(response).to(have_http_status(:not_found))
      expect(theirs.reload.read_at).to(be_nil)
    end
  end

  describe "when a booking is made" do
    let(:now) { Time.utc(2026, 11, 2, 8, 0) }
    let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["tue"], "times" => ["09:00"] } }
    let(:form) { Form.create!(user: current_user, title: "Salon") }
    let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
    let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
    let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
    let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }

    before do
      allow(Turnstile).to(receive(:check).and_return(:ok))
      travel_to(now)
      Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service] })
      Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
      Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
      Forms::Publish.call(form: form.reload)
    end

    def book(ip: "198.51.100.7")
      answers = { name_id => "Ana Secret", mail_id => "ana@secret.example", booking_id => { "service" => service_id, "sessions" => [{ "date" => "2026-11-03", "time" => "09:00" }] } }
      post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
    end

    it "tells the owner, with ids only and no personal data" do
      book
      expect(response).to(have_http_status(:created))

      get("/api/me/notifications", headers: auth_headers)
      row = json["notifications"].first
      expect(row).to(include("kind" => "appointment_created", "read_at" => nil))
      expect(row["payload"]).to(eq("form_id" => form.id, "response_id" => FormResponse.last.id, "group_key" => Appointment.last.group_key, "sessions" => 1))
      expect(response.body).not_to(include("Ana", "secret.example"))
      expect(Notification.last.appointment_id).to(eq(Appointment.last.id))
    end

    it "does not tell another user" do
      book
      get("/api/me/notifications", headers: { "Authorization" => "Bearer #{SessionToken.issue(other)}" })
      expect(json["notifications"]).to(eq([]))
    end

    it "leaves no notification when the booking fails" do
      book
      expect { book(ip: "198.51.100.8") }.not_to(change(Notification, :count))
    end

    it "removes the notification when the owner deletes the response" do
      book
      delete("/api/me/forms/#{form.id}/responses/#{FormResponse.last.id}", headers: auth_headers)
      expect(Notification.count).to(eq(0))
    end
  end

  describe "database rules" do
    it "refuses a duplicate event for the same recipient and channel" do
      make(key: "same")
      expect { make(key: "same") }.to(raise_error(ActiveRecord::RecordNotUnique))
      expect { make(user: other, key: "same") }.not_to(raise_error)
    end

    it "refuses an owner notification without a user" do
      expect { Notification.create!(channel: "in_app", kind: "k", recipient_kind: "owner", event_key: "e") }.to(raise_error(ActiveRecord::StatementInvalid))
    end
  end

  describe PurgeOldNotificationsJob do
    it "deletes notifications older than 90 days and keeps newer ones" do
      old = make
      old.update_columns(created_at: 91.days.ago)
      fresh = make
      fresh.update_columns(created_at: 89.days.ago)
      described_class.perform_now
      expect(Notification.pluck(:id)).to(eq([fresh.id]))
    end
  end
end
