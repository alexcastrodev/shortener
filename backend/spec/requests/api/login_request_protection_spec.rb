require "rails_helper"

RSpec.describe("Sign-in code protections", type: :request) do
  include ActiveJob::TestHelper

  before do
    host! "localhost"
    allow(Sentry).to(receive(:capture_message))
  end

  def request_code(email, headers: {}, **extra)
    post("/api/login_request", params: { email: email, **extra }, headers: headers, as: :json)
  end

  def json
    JSON.parse(response.body)
  end

  it "queues the email on the mailers queue for a new, deliverable address" do
    expect { request_code("new.person@example.com") }.to(have_enqueued_job(MailDeliveryJob).on_queue("mailers"))

    expect(response).to(have_http_status(:ok))
    expect(User.find_by(email: "new.person@example.com")).not_to(be_verified)
  end

  it "refuses disposable addresses and domains without a mail server" do
    request_code("someone@mailinator.com")
    expect(response).to(have_http_status(:unprocessable_entity))
    expect(json["error"]).to(eq("undeliverable_email"))

    allow_any_instance_of(ValidEmail2::Address).to(receive(:valid_mx?).and_return(false))
    request_code("someone@no-mail-server.dev")
    expect(json["error"]).to(eq("undeliverable_email"))
    expect(User.where(email: ["someone@mailinator.com", "someone@no-mail-server.dev"])).to(be_empty)
  end

  it "does not re-check addresses of verified accounts" do
    user = User.create!(email: "known@example.com", verified_at: 1.day.ago)
    allow_any_instance_of(ValidEmail2::Address).to(receive(:valid_mx?).and_return(false))

    request_code(user.email)

    expect(response).to(have_http_status(:ok))
    expect(user.reload.login_token).to(be_present)
  end

  it "rejects malformed addresses" do
    request_code("not-an-email")

    expect(response).to(have_http_status(:unprocessable_entity))
    expect(json["error"]).to(eq("invalid_email"))
  end

  it "sends nothing to deactivated accounts, without saying so" do
    user = User.create!(email: "gone@example.com", verified_at: 1.day.ago, deactivated_at: 1.hour.ago)

    expect { request_code(user.email) }.not_to(have_enqueued_job(MailDeliveryJob))
    expect(response).to(have_http_status(:ok))
  end

  it "marks the account verified on the first successful sign-in" do
    request_code("first.time@example.com")
    user = User.find_by!(email: "first.time@example.com")

    post "/api/login_verify", params: { email: user.email, code: user.login_token }, as: :json

    expect(response).to(have_http_status(:ok))
    expect(user.reload).to(be_verified)
  end

  it "refuses new addresses once their share of the day is used, but not existing accounts" do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?
    ENV["MAIL_NEW_ADDRESS_DAILY_LIMIT"] = "1"
    known = User.create!(email: "regular@example.com", verified_at: 1.week.ago)

    request_code("one@example.com")
    request_code("two@example.com")
    expect(response).to(have_http_status(:service_unavailable))
    expect(json["error"]).to(eq("new_address_limit"))

    request_code(known.email)
    expect(response).to(have_http_status(:ok))
  ensure
    ENV.delete("MAIL_NEW_ADDRESS_DAILY_LIMIT")
  end

  it "limits requests per IP, whatever the address" do
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?
    ip = { "CF-Connecting-IP" => "203.0.113.7" }

    10.times { |i| request_code("rotating#{i}@example.com", headers: ip) }
    expect(response).to(have_http_status(:ok))

    request_code("rotating-next@example.com", headers: ip)
    expect(response).to(have_http_status(:too_many_requests))

    request_code("someone.else@example.com", headers: { "CF-Connecting-IP" => "198.51.100.9" })
    expect(response).to(have_http_status(:ok))
  end

  describe "with Turnstile on" do
    around do |example|
      ENV["TURNSTILE_SECRET_KEY"] = "secret"
      example.run
    ensure
      ENV.delete("TURNSTILE_SECRET_KEY")
    end

    it "requires a valid token" do
      stub_request(:post, "https://challenges.cloudflare.com/turnstile/v0/siteverify")
        .to_return(status: 200, body: { success: true, action: "login", hostname: "kurz.fyi" }.to_json)

      request_code("human@example.com")
      expect(response).to(have_http_status(:forbidden))
      expect(json["error"]).to(eq("captcha_failed"))

      request_code("human@example.com", turnstile_token: "token")
      expect(response).to(have_http_status(:ok))
    end
  end
end
