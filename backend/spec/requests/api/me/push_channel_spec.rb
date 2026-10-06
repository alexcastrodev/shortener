require "rails_helper"

RSpec.describe("the push channel", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:other) { FactoryBot.create(:user) }
  let(:vapid) { WebPush.generate_key }
  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => nil, "days" => ["tue", "wed"], "times" => ["09:00", "10:00", "11:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
  let(:p256dh) { "B#{"a" * 86}" }
  let(:auth_secret) { "b" * 22 }
  let(:sent) { [] }
  let(:keys) { { "VAPID_PUBLIC_KEY" => vapid.public_key, "VAPID_PRIVATE_KEY" => vapid.private_key, "VAPID_SUBJECT" => "mailto:ops@kurz.fyi" } }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
    keys.each { |key, value| allow(ENV).to(receive(:[]).with(key).and_return(value)) }
    allow(WebPush).to(receive(:payload_send)) { |**args| sent << args }
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service] })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def subscribe(user = current_user, endpoint: "https://fcm.googleapis.com/fcm/send/#{SecureRandom.hex(4)}")
    PushSubscription.create!(user: user, endpoint: endpoint, p256dh: p256dh, auth: auth_secret)
  end

  def book(time: "09:00", ip: "198.51.100.#{rand(1..250)}")
    answers = { name_id => "Ana Secret", mail_id => "ana@secret.example", booking_id => { "service" => service_id, "sessions" => [{ "date" => "2026-11-03", "time" => time }] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
    expect(response).to(have_http_status(:created))
  end

  def push_rows = Notification.where(channel: "push")

  describe "the key the browser needs" do
    it "tells the front end whether push is on and gives only the public key" do
      get("/api/me/push_config", headers: auth_headers)
      expect(json).to(eq("enabled" => true, "public_key" => vapid.public_key))
      expect(response.body).not_to(include(vapid.private_key))
    end

    it "says it is off, without a key, when the server has none" do
      allow(ENV).to(receive(:[]).with("VAPID_PRIVATE_KEY").and_return(nil))
      get("/api/me/push_config", headers: auth_headers)
      expect(json).to(eq("enabled" => false, "public_key" => nil))
    end

    it "answers 401 without a token and 404 when appointments are off" do
      get("/api/me/push_config")
      expect(response).to(have_http_status(:unauthorized))
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      get("/api/me/push_config", headers: auth_headers)
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "sending" do
    it "pushes a booking to the owner's devices with no personal data" do
      subscription = subscribe
      perform_enqueued_jobs { book }

      expect(sent.size).to(eq(1))
      call = sent.first
      expect(call).to(include(endpoint: subscription.endpoint, p256dh: p256dh, auth: auth_secret))
      expect(call[:vapid]).to(eq(subject: "mailto:ops@kurz.fyi", public_key: vapid.public_key, private_key: vapid.private_key))
      message = JSON.parse(call[:message])
      expect(message).to(eq("kind" => "appointment_created", "id" => push_rows.first.id))
      expect(call.to_json).not_to(include("Ana Secret", "secret.example"))
      expect(push_rows.first).to(have_attributes(status: "sent", recipient_kind: "owner", user_id: current_user.id))
      expect(subscription.reload.last_used_at).to(be_present)
    end

    it "sends to every device of the owner and to nobody else's" do
      first = subscribe
      second = subscribe
      subscribe(other)
      perform_enqueued_jobs { book }
      expect(sent.map { |call| call[:endpoint] }).to(match_array([first.endpoint, second.endpoint]))
    end

    it "creates nothing, and the booking still works, when there are no keys or no devices" do
      subscribe
      allow(ENV).to(receive(:[]).with("VAPID_PUBLIC_KEY").and_return(nil))
      perform_enqueued_jobs { book }
      expect([push_rows.count, sent.size]).to(eq([0, 0]))

      allow(ENV).to(receive(:[]).with("VAPID_PUBLIC_KEY").and_return(vapid.public_key))
      PushSubscription.delete_all
      perform_enqueued_jobs { book(time: "10:00") }
      expect([push_rows.count, sent.size]).to(eq([0, 0]))
      expect(Appointment.count).to(eq(2))
    end

    it "respects the preference and leaves the bell alone" do
      subscribe
      put("/api/me/notification_preferences", params: { preferences: [{ kind: "appointment_created", channel: "push", enabled: false }] }, headers: auth_headers, as: :json)
      perform_enqueued_jobs { book }
      expect([push_rows.count, sent.size]).to(eq([0, 0]))
      expect(Notification.where(channel: "in_app", user_id: current_user.id).count).to(eq(1))
    end

    it "still pushes when only the bell is turned off" do
      subscribe
      put("/api/me/notification_preferences", params: { preferences: [{ kind: "appointment_created", channel: "in_app", enabled: false }] }, headers: auth_headers, as: :json)
      perform_enqueued_jobs { book }
      expect(sent.size).to(eq(1))
      expect(Notification.where(channel: "in_app").count).to(eq(0))
    end

    it "never sends to an endpoint that is no longer an allowed push service" do
      subscription = subscribe
      subscription.update_columns(endpoint: "https://169.254.169.254/latest/meta-data")
      perform_enqueued_jobs { book }
      expect(sent).to(eq([]))
      expect(PushSubscription.exists?(subscription.id)).to(be(false))
    end
  end

  describe "when the push service answers" do
    def answer(error_class)
      error_class.new(double("response", body: "", inspect: "response"), "fcm.googleapis.com")
    end

    def failing(error_class)
      allow(WebPush).to(receive(:payload_send).and_raise(answer(error_class)))
    end

    it "deletes a subscription the service says is gone (410) or unknown (404)" do
      [WebPush::ExpiredSubscription, WebPush::InvalidSubscription].each_with_index do |error, index|
        gone = subscribe
        failing(error)
        perform_enqueued_jobs { book(time: ["09:00", "10:00"][index]) }
        expect(PushSubscription.exists?(gone.id)).to(be(false))
        expect(push_rows.order(:id).last.status).to(eq("sent"))
      end
    end

    it "keeps the good device when another one is gone" do
      gone = subscribe(endpoint: "https://fcm.googleapis.com/fcm/send/gone")
      good = subscribe(endpoint: "https://fcm.googleapis.com/fcm/send/good")
      allow(WebPush).to(receive(:payload_send)) do |**args|
        raise answer(WebPush::ExpiredSubscription) if args[:endpoint].end_with?("gone")

        sent << args
      end
      perform_enqueued_jobs { book }
      expect(sent.map { |call| call[:endpoint] }).to(eq([good.endpoint]))
      expect([PushSubscription.exists?(gone.id), PushSubscription.exists?(good.id)]).to(eq([false, true]))
    end

    it "retries later on 429, keeps the subscription, and delivers on the next sweep" do
      subscription = subscribe
      failing(WebPush::TooManyRequests)
      perform_enqueued_jobs { book }
      row = push_rows.first
      expect(row).to(have_attributes(status: "pending", attempts: 1, next_attempt_at: now + 5.minutes))
      expect(PushSubscription.exists?(subscription.id)).to(be(true))

      allow(WebPush).to(receive(:payload_send)) { |**args| sent << args }
      travel_to(now + 6.minutes) { perform_enqueued_jobs { DispatchNotificationsJob.perform_now } }
      expect(row.reload.status).to(eq("sent"))
      expect(sent.size).to(eq(1))
    end

    it "gives up with a failure on an authorisation problem and does not retry" do
      subscribe
      failing(WebPush::Unauthorized)
      perform_enqueued_jobs { book }
      expect(push_rows.first).to(have_attributes(status: "failed", last_error: "WebPush::Unauthorized"))
    end

    it "does not send twice when the delivery job runs twice" do
      subscribe
      perform_enqueued_jobs { book }
      expect { PushDeliveryJob.perform_now(push_rows.first.id) }.not_to(change { sent.size })
    end
  end
end
