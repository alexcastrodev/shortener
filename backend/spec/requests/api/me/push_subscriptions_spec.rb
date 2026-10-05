require "rails_helper"

RSpec.describe("/api/me/push_subscriptions", type: :request) do
  include_context "authenticated user"

  let(:other) { FactoryBot.create(:user) }
  let(:p256dh) { "B#{"a" * 86}" }
  let(:auth_secret) { "b" * 22 }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
  end

  def json
    JSON.parse(response.body)
  end

  def subscribe(endpoint = "https://fcm.googleapis.com/fcm/send/abc123", headers: auth_headers, **overrides)
    post("/api/me/push_subscriptions", params: { endpoint: endpoint, p256dh: p256dh, auth: auth_secret }.merge(overrides), headers: headers, as: :json)
  end

  it "answers 401 without a token on every route and 404 when the feature is off" do
    row = PushSubscription.create!(user: current_user, endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: p256dh, auth: auth_secret)
    [[:get, "/api/me/push_subscriptions"], [:post, "/api/me/push_subscriptions"], [:delete, "/api/me/push_subscriptions/#{row.id}"]].each do |verb, path|
      send(verb, path)
      expect(response).to(have_http_status(:unauthorized), "#{verb} #{path}")
    end
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
    subscribe
    expect(response).to(have_http_status(:not_found))
  end

  describe "subscribing" do
    it "stores the subscription and never returns the endpoint or keys" do
      subscribe
      expect(response).to(have_http_status(:created))
      expect(json["push_subscription"].keys).to(match_array(["id", "label", "created_at"]))
      expect(response.body).not_to(include("fcm.googleapis.com", p256dh, auth_secret))
      expect(PushSubscription.last).to(have_attributes(user_id: current_user.id, endpoint: "https://fcm.googleapis.com/fcm/send/abc123"))
    end

    [
      "https://fcm.googleapis.com/fcm/send/a",
      "https://updates.push.services.mozilla.com/wpush/v2/a",
      "https://web.push.apple.com/a",
      "https://wns2-par02p.notify.windows.com/w/?token=a",
    ].each do |endpoint|
      it "accepts #{URI.parse(endpoint).host}" do
        subscribe(endpoint)
        expect(response).to(have_http_status(:created))
      end
    end

    [
      "http://fcm.googleapis.com/fcm/send/a",
      "https://evil.example.com/a",
      "https://fcm.googleapis.com.evil.example/a",
      "https://evilfcm.googleapis.com/a",
      "https://user:pw@fcm.googleapis.com/a",
      "https://fcm.googleapis.com:8443/a",
      "https://127.0.0.1/a",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/a",
      "javascript:alert(1)",
      "ftp://fcm.googleapis.com/a",
      "not a url",
    ].each do |endpoint|
      it "refuses #{endpoint}" do
        expect { subscribe(endpoint) }.not_to(change(PushSubscription, :count))
        expect(response).to(have_http_status(:unprocessable_entity))
      end
    end

    it "refuses bad keys and missing fields" do
      subscribe(p256dh: "short")
      expect(response).to(have_http_status(:unprocessable_entity))
      subscribe(auth: "not base64url!!!!!!!!!!!!!!")
      expect(response).to(have_http_status(:unprocessable_entity))
      post("/api/me/push_subscriptions", params: { endpoint: "https://fcm.googleapis.com/a" }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(PushSubscription.count).to(eq(0))
    end

    it "refuses an endpoint over 2048 characters" do
      subscribe("https://fcm.googleapis.com/#{"a" * 2048}")
      expect(response).to(have_http_status(:unprocessable_entity))
    end

    it "allows five per user and refuses the sixth, but lets an existing one be renewed" do
      5.times { |index| subscribe("https://fcm.googleapis.com/fcm/send/n#{index}") }
      expect(PushSubscription.where(user_id: current_user.id).count).to(eq(5))
      subscribe("https://fcm.googleapis.com/fcm/send/n5")
      expect(response).to(have_http_status(:unprocessable_entity))
      expect(json["errors"]["base"]).to(eq(["limit_reached"]))

      subscribe("https://fcm.googleapis.com/fcm/send/n0", auth: "c" * 22)
      expect(response).to(have_http_status(:created))
      expect(PushSubscription.where(user_id: current_user.id).count).to(eq(5))
      expect(PushSubscription.find_by(endpoint: "https://fcm.googleapis.com/fcm/send/n0").auth).to(eq("c" * 22))
    end

    it "does not count another user's subscriptions toward my limit" do
      5.times { |index| PushSubscription.create!(user: other, endpoint: "https://fcm.googleapis.com/fcm/send/o#{index}", p256dh: p256dh, auth: auth_secret) }
      subscribe
      expect(response).to(have_http_status(:created))
    end

    it "moves a browser's subscription to whoever signs in there now" do
      PushSubscription.create!(user: other, endpoint: "https://fcm.googleapis.com/fcm/send/shared", p256dh: p256dh, auth: auth_secret)
      subscribe("https://fcm.googleapis.com/fcm/send/shared")
      expect(response).to(have_http_status(:created))
      expect(PushSubscription.where(endpoint: "https://fcm.googleapis.com/fcm/send/shared").pluck(:user_id)).to(eq([current_user.id]))
    end
  end

  describe "listing and removing" do
    it "lists only my subscriptions" do
      mine = PushSubscription.create!(user: current_user, endpoint: "https://fcm.googleapis.com/fcm/send/mine", p256dh: p256dh, auth: auth_secret)
      PushSubscription.create!(user: other, endpoint: "https://fcm.googleapis.com/fcm/send/theirs", p256dh: p256dh, auth: auth_secret)
      get("/api/me/push_subscriptions", headers: auth_headers)
      expect(json["push_subscriptions"].map { |row| row["id"] }).to(eq([mine.id]))
    end

    it "removes my subscription" do
      mine = PushSubscription.create!(user: current_user, endpoint: "https://fcm.googleapis.com/fcm/send/mine", p256dh: p256dh, auth: auth_secret)
      delete("/api/me/push_subscriptions/#{mine.id}", headers: auth_headers)
      expect(response).to(have_http_status(:no_content))
      expect(PushSubscription.count).to(eq(0))
    end

    it "answers 404 for someone else's subscription and keeps it" do
      theirs = PushSubscription.create!(user: other, endpoint: "https://fcm.googleapis.com/fcm/send/theirs", p256dh: p256dh, auth: auth_secret)
      delete("/api/me/push_subscriptions/#{theirs.id}", headers: auth_headers)
      expect(response).to(have_http_status(:not_found))
      expect(PushSubscription.count).to(eq(1))
    end
  end

  it "removes subscriptions with the account" do
    PushSubscription.create!(user: other, endpoint: "https://fcm.googleapis.com/fcm/send/theirs", p256dh: p256dh, auth: auth_secret)
    other.destroy!
    expect(PushSubscription.count).to(eq(0))
  end
end
