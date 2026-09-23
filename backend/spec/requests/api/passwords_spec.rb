require "rails_helper"

RSpec.describe("Passwords", type: :request) do
  include ActiveJob::TestHelper

  let(:password) { "correct horse battery" }

  before do
    host! "localhost"
    allow(Sentry).to(receive(:capture_message))
  end

  def json
    JSON.parse(response.body)
  end

  def verified_user(email: "owner@example.com", password: self.password)
    User.create!(email: email, verified_at: 1.day.ago).tap { |user| user.change_password!(password) if password }
  end

  def session_cookie
    response.cookies[SessionCookie::NAME]
  end

  describe "POST /api/login/password" do
    it "signs in with the right password" do
      verified_user

      post "/api/login/password", params: { email: "Owner@Example.com", password: password }, as: :json

      expect(response).to(have_http_status(:ok))
      expect(session_cookie).to(be_present)
      expect(json["user"]).to(include("email" => "owner@example.com", "has_password" => true))
      expect(response.body).not_to(include("digest"))
    end

    it "gives one answer for a wrong password, an unknown email and an unconfirmed account" do
      verified_user
      User.create!(email: "pending@example.com").tap { |user| user.stage_pending_password!(password) }

      [["owner@example.com", "wrong password!!"], ["nobody@example.com", password], ["pending@example.com", password]].each do |email, attempt|
        post "/api/login/password", params: { email: email, password: attempt }, as: :json
        expect(response).to(have_http_status(:unauthorized))
        expect(json).to(eq("error" => "invalid_credentials"))
      end
    end

    it "locks the password after repeated failures, doubling the wait" do
      user = verified_user

      5.times { post("/api/login/password", params: { email: user.email, password: "wrong password!!" }, as: :json) }
      expect(user.reload.password_locked_until).to(be_within(5.seconds).of(1.minute.from_now))

      post "/api/login/password", params: { email: user.email, password: password }, as: :json
      expect(response).to(have_http_status(:unauthorized))

      travel_to(2.minutes.from_now) do
        post "/api/login/password", params: { email: user.email, password: "wrong again!!!" }, as: :json
        expect(user.reload.password_locked_until).to(be_within(5.seconds).of(2.minutes.from_now))
      end
    end

    it "does not let deactivated accounts in" do
      verified_user.update!(deactivated_at: Time.current)

      post "/api/login/password", params: { email: "owner@example.com", password: password }, as: :json

      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "sign-up" do
    it "creates an unconfirmed account and turns the password on only when the code confirms it" do
      expect { post("/api/signup", params: { email: "new@example.com", password: password }, as: :json) }
        .to(have_enqueued_job(MailDeliveryJob))
      user = User.find_by!(email: "new@example.com")
      expect(user).not_to(be_verified)
      expect(user.password?).to(be(false))

      post "/api/login_verify", params: { email: user.email, code: user.login_token, purpose: "sign_up" }, as: :json

      expect(response).to(have_http_status(:ok))
      expect(user.reload).to(be_verified)
      expect(user.password?).to(be(true))
    end

    it "drops a password someone else chose when the owner signs in with a plain code" do
      post "/api/signup", params: { email: "victim@example.com", password: "attacker password" }, as: :json
      user = User.find_by!(email: "victim@example.com")

      post "/api/login_verify", params: { email: user.email, code: user.login_token }, as: :json

      expect(response).to(have_http_status(:ok))
      expect(user.reload.password?).to(be(false))
      expect(user.pending_password_digest).to(be_nil)
    end

    it "only changes an existing account's password once the owner confirms the emailed code" do
      user = verified_user
      old_token = SessionToken.issue(user)

      post "/api/signup", params: { email: user.email, password: "brand new password" }, as: :json
      expect(response).to(have_http_status(:ok))
      expect(user.reload.authenticate_password(password)).to(be(true))

      travel_to(2.seconds.from_now) do
        post "/api/login_verify", params: { email: user.email, code: user.reload.login_token, purpose: "sign_up" }, as: :json

        expect(response).to(have_http_status(:ok))
        expect(user.reload.authenticate_password("brand new password")).to(be(true))
        get "/api/me", headers: { "Authorization" => "Bearer #{old_token}" }
        expect(response).to(have_http_status(:unauthorized))
      end
    end

    it "keeps the existing password when the owner signs in with a plain code instead" do
      user = verified_user
      post "/api/signup", params: { email: user.email, password: "attacker password" }, as: :json

      post "/api/login_verify", params: { email: user.email, code: user.reload.login_token }, as: :json

      expect(user.reload.authenticate_password(password)).to(be(true))
      expect(user.pending_password_digest).to(be_nil)
    end

    it "adds a password to an account created with Google" do
      user = User.create!(email: "google.first@gmail.com", verified_at: 1.day.ago)
      user.identities.create!(provider: "google", uid: "g-1", email: user.email)

      expect { post("/api/signup", params: { email: user.email, password: password }, as: :json) }
        .to(have_enqueued_job(MailDeliveryJob).with("LoginMailer", "magic_link", "deliver_now", hash_including(params: hash_including(purpose: "sign_up_existing"))))
      post "/api/login_verify", params: { email: user.email, code: user.reload.login_token, purpose: "sign_up" }, as: :json

      expect(response).to(have_http_status(:ok))
      expect(JSON.parse(response.body)["user"]).to(include("has_password" => true, "google_connected" => true))

      post "/api/login/password", params: { email: user.email, password: password }, as: :json
      expect(response).to(have_http_status(:ok))
    end

    it "accepts a password of exactly 8 characters" do
      post "/api/signup", params: { email: "eight@example.com", password: "k7#vq2!m" }, as: :json

      expect(response).to(have_http_status(:ok))
    end

    it "rejects short, email-based and breached passwords" do
      post "/api/signup", params: { email: "someone@example.com", password: "short" }, as: :json
      expect(json["error"]).to(eq("password_too_short"))

      post "/api/signup", params: { email: "marina@example.com", password: "marina2024!" }, as: :json
      expect(json["error"]).to(eq("password_matches_email"))

      sha1 = Digest::SHA1.hexdigest("password123456").upcase
      stub_request(:get, "https://api.pwnedpasswords.com/range/#{sha1[0, 5]}").to_return(body: "#{sha1[5..]}:120\r\nAAAA:0")
      post "/api/signup", params: { email: "someone@example.com", password: "password123456" }, as: :json
      expect(json["error"]).to(eq("password_breached"))
      expect(User.where(email: ["someone@example.com", "marina@example.com"])).to(be_empty)
    end
  end

  describe "password reset" do
    it "emails a code only to existing accounts, with the same answer for everyone" do
      verified_user

      expect { post("/api/password/forgot", params: { email: "owner@example.com" }, as: :json) }.to(have_enqueued_job(MailDeliveryJob))
      expect(response).to(have_http_status(:ok))

      expect { post("/api/password/forgot", params: { email: "nobody@example.com" }, as: :json) }.not_to(have_enqueued_job(MailDeliveryJob))
      expect(response).to(have_http_status(:ok))
      expect(User.exists?(email: "nobody@example.com")).to(be(false))
    end

    it "sets the new password, signs in and ends every other session" do
      user = verified_user
      old_token = SessionToken.issue(user)
      post "/api/password/forgot", params: { email: user.email }, as: :json

      travel_to(2.seconds.from_now) do
        post "/api/password/reset", params: { email: user.email, code: user.reload.login_token, password: "brand new password" }, as: :json

        expect(response).to(have_http_status(:ok))
        expect(session_cookie).to(be_present)
        expect(user.reload.authenticate_password("brand new password")).to(be(true))

        get "/api/me", headers: { "Authorization" => "Bearer #{old_token}" }
        expect(response).to(have_http_status(:unauthorized))
      end
    end

    it "refuses a wrong code" do
      user = verified_user
      post "/api/password/forgot", params: { email: user.email }, as: :json

      post "/api/password/reset", params: { email: user.email, code: "0000000", password: "brand new password" }, as: :json

      expect(response).to(have_http_status(:unauthorized))
      expect(user.reload.authenticate_password(password)).to(be(true))
    end
  end

  describe "PUT /api/me/password" do
    it "needs the current password to change it" do
      user = verified_user
      headers = { "Authorization" => "Bearer #{SessionToken.issue(user)}" }

      put "/api/me/password", params: { current_password: "not it at all", password: "brand new password" }, headers: headers, as: :json
      expect(json["error"]).to(eq("invalid_current_password"))

      put "/api/me/password", params: { current_password: password, password: "brand new password" }, headers: headers, as: :json
      expect(response).to(have_http_status(:ok))
      expect(session_cookie).to(be_present)
      expect(user.reload.authenticate_password("brand new password")).to(be(true))
    end

    it "lets code-only accounts set a first password right after signing in, not hours later" do
      user = verified_user(password: nil)

      recent = { "Authorization" => "Bearer #{SessionToken.issue(user)}" }
      stale = travel_to(1.hour.ago) { { "Authorization" => "Bearer #{SessionToken.issue(user)}" } }

      put "/api/me/password", params: { password: "brand new password" }, headers: stale, as: :json
      expect(json["error"]).to(eq("reauthentication_required"))

      put "/api/me/password", params: { password: "brand new password" }, headers: recent, as: :json
      expect(response).to(have_http_status(:ok))
      expect(json["user"]["has_password"]).to(be(true))
    end
  end
end
