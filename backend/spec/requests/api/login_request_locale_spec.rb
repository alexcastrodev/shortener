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
end
