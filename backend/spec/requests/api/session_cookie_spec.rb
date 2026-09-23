require "rails_helper"

RSpec.describe("Session cookie and token", type: :request) do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { FactoryBot.create(:user) }

  before do
    host! "localhost"
  end

  def sign_in
    user.generate_login_token!
    post "/api/login_verify", params: { email: user.email, code: user.login_token }, as: :json
    expect(response).to(have_http_status(:ok))
  end

  it "authenticates reads with the cookie alone" do
    sign_in

    get "/api/me"

    expect(response).to(have_http_status(:ok))
    expect(JSON.parse(response.body)["user"]["email"]).to(eq(user.email))
  end

  it "rejects cookie-authenticated writes without X-Requested-With (CSRF)" do
    sign_in

    post "/api/me/shortlinks", params: { original_url: "https://example.com" }, as: :json

    expect(response).to(have_http_status(:forbidden))
    expect(Shortlink.count).to(eq(0))
  end

  it "accepts cookie-authenticated writes with X-Requested-With" do
    sign_in

    post "/api/me/shortlinks",
      params: { original_url: "https://example.com" },
      headers: { "X-Requested-With" => "XMLHttpRequest" },
      as: :json

    expect(response).to(have_http_status(:created))
  end

  it "does not require X-Requested-With for Bearer clients" do
    post "/api/me/shortlinks",
      params: { original_url: "https://example.com" },
      headers: { "Authorization" => "Bearer #{SessionToken.issue(user)}" },
      as: :json

    expect(response).to(have_http_status(:created))
  end

  it "logs out: clears the cookie and revokes the token itself" do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?
    sign_in
    stolen_copy = cookies["kurz_session"]

    delete "/api/logout", headers: { "X-Requested-With" => "XMLHttpRequest" }

    expect(response).to(have_http_status(:no_content))
    expect(cookies["kurz_session"]).to(be_blank)

    get "/api/me", headers: { "Authorization" => "Bearer #{stolen_copy}" }
    expect(response).to(have_http_status(:unauthorized))
  end

  it "logs out cleanly without a session" do
    delete "/api/logout"

    expect(response).to(have_http_status(:no_content))
  end

  describe "rejected tokens" do
    def me_with(token)
      get "/api/me", headers: { "Authorization" => "Bearer #{token}" }
      response
    end

    it "rejects tokens signed with secret_key_base (the old scheme)" do
      token = JWT.encode({ sub: user.id, jti: "x", exp: 1.hour.from_now.to_i }, Rails.application.secret_key_base, "HS256")

      expect(me_with(token)).to(have_http_status(:unauthorized))
    end

    it "rejects unsigned tokens (alg none)" do
      token = JWT.encode({ sub: user.id, jti: "x", exp: 1.hour.from_now.to_i }, nil, "none")

      expect(me_with(token)).to(have_http_status(:unauthorized))
    end

    it "rejects expired tokens" do
      token = travel_to(3.days.ago) { SessionToken.issue(user) }

      expect(me_with(token)).to(have_http_status(:unauthorized))
    end

    it "rejects tokens without a jti" do
      key = SessionToken.send(:key)
      token = JWT.encode({ sub: user.id, exp: 1.hour.from_now.to_i }, key, "HS256")

      expect(me_with(token)).to(have_http_status(:unauthorized))
    end
  end
end
