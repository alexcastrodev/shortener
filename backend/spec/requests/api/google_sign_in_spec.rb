require "rails_helper"

RSpec.describe("Sign in with Google", type: :request) do
  let(:client_id) { "kurz-test.apps.googleusercontent.com" }

  around do |example|
    ENV["GOOGLE_CLIENT_ID"] = client_id
    example.run
  ensure
    ENV.delete("GOOGLE_CLIENT_ID")
  end

  before do
    host! "localhost"
  end

  def google_says(sub: "google-123", email: "marina@gmail.com", email_verified: true)
    allow(Google::Auth::IDTokens).to(receive(:verify_oidc).with("id-token", aud: client_id)
      .and_return("sub" => sub, "email" => email, "email_verified" => email_verified))
  end

  def sign_in(credential = "id-token")
    post("/api/login/google", params: { credential: credential }, as: :json)
  end

  def json
    JSON.parse(response.body)
  end

  it "creates a verified account on the first sign-in, without sending email" do
    google_says

    expect { sign_in }.not_to(have_enqueued_job(MailDeliveryJob))

    expect(response).to(have_http_status(:ok))
    expect(response.cookies[SessionCookie::NAME]).to(be_present)
    user = User.find_by!(email: "marina@gmail.com")
    expect(user).to(be_verified)
    expect(json["user"]).to(include("google_connected" => true, "has_password" => false))
  end

  it "links to the existing account with the same email, and finds it by Google id afterwards" do
    user = User.create!(email: "marina@gmail.com", verified_at: 1.year.ago)
    google_says
    sign_in
    expect(user.identities.pluck(:provider, :uid)).to(eq([["google", "google-123"]]))

    # The Gmail address changed on Google's side; the stable id still matches.
    google_says(email: "marina.costa@gmail.com")
    sign_in

    expect(response).to(have_http_status(:ok))
    expect(User.count).to(eq(1))
  end

  it "drops a password someone else staged on an unconfirmed account" do
    squatted = User.create!(email: "marina@gmail.com").tap { |user| user.stage_pending_password!("attacker password") }
    google_says

    sign_in

    expect(squatted.reload).to(be_verified)
    expect(squatted.pending_password_digest).to(be_nil)
    expect(squatted.password?).to(be(false))
  end

  it "refuses tokens Google cannot vouch for" do
    allow(Google::Auth::IDTokens).to(receive(:verify_oidc).and_raise(Google::Auth::IDTokens::SignatureError))
    sign_in
    expect(response).to(have_http_status(:unauthorized))
    expect(json["error"]).to(eq("google_invalid_token"))

    google_says(email_verified: false)
    sign_in
    expect(json["error"]).to(eq("google_email_not_verified"))
    expect(User.count).to(eq(0))
  end

  it "keeps deactivated accounts out" do
    User.create!(email: "marina@gmail.com", verified_at: 1.year.ago, deactivated_at: 1.day.ago)
    google_says

    sign_in

    expect(response).to(have_http_status(:forbidden))
    expect(response.cookies[SessionCookie::NAME]).to(be_nil)
  end

  describe "with the popup's one-time code" do
    let(:token_url) { "https://oauth2.googleapis.com/token" }

    around do |example|
      ENV["GOOGLE_CLIENT_SECRET"] = "secret"
      example.run
    ensure
      ENV.delete("GOOGLE_CLIENT_SECRET")
    end

    it "exchanges the code with the client secret, then signs in with the ID token" do
      stub_request(:post, token_url).to_return(status: 200, body: { id_token: "id-token" }.to_json)
      google_says

      post "/api/login/google", params: { code: "one-time-code" }, as: :json

      expect(response).to(have_http_status(:ok))
      expect(a_request(:post, token_url).with(body: hash_including(
        "code" => "one-time-code",
        "client_id" => client_id,
        "client_secret" => "secret",
        "redirect_uri" => "postmessage",
        "grant_type" => "authorization_code",
      ))).to(have_been_made)
      expect(User.find_by!(email: "marina@gmail.com")).to(be_verified)
    end

    it "refuses a code Google does not accept" do
      stub_request(:post, token_url).to_return(status: 400, body: { error: "invalid_grant" }.to_json)

      post "/api/login/google", params: { code: "reused-code" }, as: :json

      expect(response).to(have_http_status(:unauthorized))
      expect(json["error"]).to(eq("google_invalid_token"))
    end
  end

  it "is off without a client id" do
    ENV.delete("GOOGLE_CLIENT_ID")

    sign_in

    expect(response).to(have_http_status(:not_found))
  end
end
