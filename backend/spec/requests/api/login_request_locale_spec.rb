require "rails_helper"

RSpec.describe("Language of the emailed code", type: :request) do
  include ActiveJob::TestHelper

  before do
    host! "localhost"
    ActionMailer::Base.deliveries.clear
    allow(Sentry).to(receive(:capture_message))
  end

  def deliver(path, params)
    perform_enqueued_jobs { post(path, params: params, as: :json) }
    ActionMailer::Base.deliveries.last
  end

  it "sends the sign-in code in the language the visitor was reading" do
    mail = deliver("/api/login_request", email: "new.person@example.com", locale: "pt-PT")

    expect(mail.subject).to(end_with("é o seu código de acesso ao Kurz"))
  end

  it "sends the sign-up code in that language too" do
    mail = deliver("/api/signup", email: "novo@example.com", password: "a long enough passphrase", locale: "pt-PT")

    expect(mail.subject).to(end_with("é o seu código de confirmação do Kurz"))
  end

  it "keeps English when the request names none, or one that is not supported" do
    expect(deliver("/api/login_request", email: "a.person@example.com").subject).to(end_with("is your Kurz sign-in code"))
    expect(deliver("/api/login_request", email: "b.person@example.com", locale: "xx").subject).to(end_with("is your Kurz sign-in code"))
  end

  describe "the language saved on the account" do
    def locale_of(email) = User.find_by(email: email)&.locale

    it "is the language of the sign-up for a new account" do
      deliver("/api/signup", email: "novo@example.com", password: "a long enough passphrase", locale: "pt-PT")

      expect(locale_of("novo@example.com")).to(eq("pt-PT"))
    end

    it "is the language of the first code request for an address Kurz did not know" do
      deliver("/api/login_request", email: "first@example.com", locale: "pt-PT")

      expect(locale_of("first@example.com")).to(eq("pt-PT"))
    end

    it "stays empty for a language Kurz does not speak" do
      deliver("/api/login_request", email: "french@example.com", locale: "fr")

      expect(locale_of("french@example.com")).to(be_nil)
    end

    it "is not changed by someone asking a code for an existing account" do
      User.create!(email: "owner@example.com", verified_at: Time.current)
      User.create!(email: "chosen@example.com", locale: "en", verified_at: Time.current)
      deliver("/api/login_request", email: "owner@example.com", locale: "pt-PT")
      deliver("/api/login_request", email: "chosen@example.com", locale: "pt-PT")

      expect([locale_of("owner@example.com"), locale_of("chosen@example.com")]).to(eq([nil, "en"]))
    end

    it "is filled in at sign-in when the account had none, and kept when it had one" do
      empty = User.create!(email: "empty@example.com", verified_at: Time.current).tap(&:generate_login_token!)
      chosen = User.create!(email: "chosen@example.com", locale: "en", verified_at: Time.current).tap(&:generate_login_token!)

      post("/api/login_verify", params: { email: empty.email, code: empty.login_token, locale: "pt-PT" }, as: :json)
      post("/api/login_verify", params: { email: chosen.email, code: chosen.login_token, locale: "pt-PT" }, as: :json)

      expect([empty.reload.locale, chosen.reload.locale]).to(eq(["pt-PT", "en"]))
    end

    it "ignores an unsupported language at sign-in" do
      user = User.create!(email: "empty@example.com", verified_at: Time.current).tap(&:generate_login_token!)

      post("/api/login_verify", params: { email: user.email, code: user.login_token, locale: "de" }, as: :json)

      expect(response).to(have_http_status(:ok))
      expect(user.reload.locale).to(be_nil)
    end

    it "is filled in by a password sign-in too" do
      user = User.create!(email: "pw@example.com", verified_at: Time.current).tap { |created| created.change_password!("a long enough passphrase") }

      post("/api/login/password", params: { email: user.email, password: "a long enough passphrase", locale: "pt-PT" }, as: :json)

      expect(response).to(have_http_status(:ok))
      expect(user.reload.locale).to(eq("pt-PT"))
    end
  end
end
