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
end
