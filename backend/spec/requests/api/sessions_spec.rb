require "rails_helper"

RSpec.describe("Sessions", type: :request) do
  before do
    host! "localhost"
  end

  describe "POST /api/login_verify" do
    it "signs in with a valid token" do
      user = FactoryBot.create(:user)
      user.generate_login_token!

      post "/api/login_verify",
        params: { email: user.email, code: user.login_token },
        as: :json

      expect(response).to(have_http_status(:ok))
      body = JSON.parse(response.body)
      expect(body["token"]).to(be_present)
      expect(user.reload.login_token).to(be_nil)
    end

    it "rejects an invalid token" do
      user = FactoryBot.create(:user)
      user.generate_login_token!

      post "/api/login_verify",
        params: { email: user.email, code: "9999999" },
        as: :json

      expect(response).to(have_http_status(:unauthorized))
    end

    it "blocks login for deactivated users" do
      user = FactoryBot.create(:user)
      user.generate_login_token!
      user.update!(deactivated_at: Time.current)

      post "/api/login_verify",
        params: { email: user.email, code: user.login_token },
        as: :json

      expect(response).to(have_http_status(:forbidden))
      body = JSON.parse(response.body)
      expect(body["error"]).to(eq(I18n.t("errors.account_deactivated")))
    end

    it "burns the token after too many wrong codes" do
      user = FactoryBot.create(:user)
      user.generate_login_token!
      valid_code = user.login_token

      User::MAX_LOGIN_ATTEMPTS.times do
        post "/api/login_verify", params: { email: user.email, code: "9999999" }, as: :json
      end

      post "/api/login_verify", params: { email: user.email, code: valid_code }, as: :json

      expect(response).to(have_http_status(:unauthorized))
      expect(user.reload.login_token).to(be_nil)
    end

    it "matches the email case-insensitively" do
      user = FactoryBot.create(:user)
      user.generate_login_token!

      post "/api/login_verify", params: { email: user.email.upcase, code: user.login_token }, as: :json

      expect(response).to(have_http_status(:ok))
    end

    context "development bypass code 0000000" do
      it "signs in without a matching token when in development" do
        allow(Rails).to(receive(:env).and_return(ActiveSupport::StringInquirer.new("development")))
        user = FactoryBot.create(:user)
        user.generate_login_token!

        post "/api/login_verify",
          params: { email: user.email, code: "0000000" },
          as: :json

        expect(response).to(have_http_status(:ok))
        body = JSON.parse(response.body)
        expect(body["token"]).to(be_present)
      end

      it "is ignored outside of development" do
        user = FactoryBot.create(:user)
        user.generate_login_token!

        post "/api/login_verify",
          params: { email: user.email, code: "0000000" },
          as: :json

        expect(response).to(have_http_status(:unauthorized))
      end
    end
  end

  describe "POST /api/login_request" do
    it "does not resend the magic link within the cooldown" do
      user = FactoryBot.create(:user)

      post "/api/login_request", params: { email: user.email }, as: :json
      first_token = user.reload.login_token

      post "/api/login_request", params: { email: user.email }, as: :json

      expect(response).to(have_http_status(:ok))
      expect(user.reload.login_token).to(eq(first_token))
    end

    # Rate limiting needs a real cache store; the test env only has one when
    # REDIS_URL is set (as in CI).
    it "rate limits repeated requests for the same email" do
      skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?

      email = "limited+#{SecureRandom.hex(4)}@example.com"
      5.times { post("/api/login_request", params: { email: email }, as: :json) }
      expect(response).to(have_http_status(:ok))

      post "/api/login_request", params: { email: email.upcase }, as: :json

      expect(response).to(have_http_status(:too_many_requests))
    end
  end
end
