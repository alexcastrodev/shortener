require "rails_helper"

RSpec.describe("Personal data export", type: :request) do
  let(:user) { FactoryBot.create(:user, email: "me@example.com") }
  let(:other) { FactoryBot.create(:user) }
  let(:headers) { { "Authorization" => "Bearer #{SessionToken.issue(user)}" } }
  let(:fields) do
    [
      { "id" => "name0001", "type" => "short_text", "label" => "Name" },
      { "id" => "pick0001", "type" => "single_choice", "label" => "Pick", "choices" => [{ "id" => "choice01", "label" => "Red" }, { "id" => "choice02", "label" => "Blue" }] },
      { "id" => "photo001", "type" => "image", "label" => "Photo" },
    ]
  end
  let!(:link) { user.shortlinks.create!(original_url: "https://example.com/mine", title: "Mine", password: "secret-pass") }
  let!(:page) { Page.create!(user: user, slug: "my-page", bio: "hello").tap { |p| p.page_links.create!(label: "Site", url: "https://example.com", kind: "link", position: 0) } }
  let!(:form) { Form.create!(user: user, title: "Survey", fields: fields) }

  before { host! "localhost" }

  include ActiveJob::TestHelper

  around do |example|
    previous = ENV["GMAIL_USERNAME"]
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    example.run
  ensure
    ENV["GMAIL_USERNAME"] = previous
  end

  let(:deliveries) { ActionMailer::Base.deliveries }

  before do
    deliveries.clear
    Rails.cache.clear
  end

  def export(params = {}, hdrs = headers)
    post("/api/me/data_export", params: params, headers: hdrs, as: :json)
  end

  def sent_json
    mail = deliveries.find { |item| item.to == [user.email] && item.attachments.any? }
    JSON.parse(mail.attachments.first.body.decoded)
  end

  it "queues the request on the mailers queue and answers at once, without the data" do
    expect { export }.to(have_enqueued_job(SendDataExportJob).on_queue("mailers").with(user.id))
    expect(response).to(have_http_status(:accepted))
    expect(JSON.parse(response.body)).to(eq("queued" => true))
    expect(response.body).not_to(include("me@example.com"))
    expect(deliveries).to(be_empty)
  end

  it "emails everything the user owns as a JSON attachment, with choices as labels, to the account's address only" do
    FormResponse.create!(form: form, answers: { "name0001" => "Ana", "pick0001" => "choice02", "photo001" => "T" * 24 }, country: "PT", platform: "iOS")

    perform_enqueued_jobs { export }

    mail = deliveries.find { |item| item.attachments.any? }
    expect(mail.to).to(eq(["me@example.com"]))
    expect(mail.subject).to(eq("Your Kurz data"))
    expect(mail.attachments.first.filename).to(match(/\Akurz-data-\d{4}-\d{2}-\d{2}\.json\z/))
    expect(mail.attachments.first.mime_type).to(eq("application/json"))
    data = sent_json
    expect(data["account"]).to(include("email" => "me@example.com"))
    expect(data["shortlinks"].first).to(include("original_url" => "https://example.com/mine", "title" => "Mine", "password_protected" => true))
    expect(data["pages"].first).to(include("slug" => "my-page", "bio" => "hello"))
    expect(data["pages"].first["links"].first).to(include("label" => "Site"))
    answers = data["forms"].first["responses"].first
    expect(answers["answers"]).to(eq("Name" => "Ana", "Pick" => "Blue", "Photo" => { "type" => "image" }))
    expect(answers).to(include("country" => "PT", "platform" => "iOS"))
  end

  it "never includes secrets, hashes, tokens, upload tokens or visitor IP addresses" do
    Event.create!(shortlink: link, ip_address: "198.51.100.77", clicked_at: Time.current)
    user.generate_login_token!
    user.change_password!("a-long-enough-password-1")
    client = OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"])
    grant = OauthGrant.create!(user: user.reload, oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp")
    OauthAccessToken.issue(grant)
    FormResponse.create!(form: form, answers: { "photo001" => "TOKENTOKENTOKENTOKENTOKE" })

    perform_enqueued_jobs { post("/api/me/data_export", params: { current_password: "a-long-enough-password-1" }, headers: { "Authorization" => "Bearer #{SessionToken.issue(user.reload)}" }, as: :json) }

    body = JSON.generate(sent_json)
    ["198.51.100.77", "TOKENTOKEN", "secret-pass", "password_digest", "login_token", "kz_at_", "kz_rt_", user.password_digest.to_s].each { |secret| expect(body).not_to(include(secret), secret) }
    expect(sent_json["connected_apps"].first).to(include("client" => "Claude", "scopes" => ["forms:read"]))
  end

  it "contains nothing that belongs to another user" do
    other.shortlinks.create!(original_url: "https://example.com/theirs")
    Page.create!(user: other, slug: "their-page")
    Form.create!(user: other, title: "Theirs", fields: fields).tap { |theirs| FormResponse.create!(form: theirs, answers: { "name0001" => "Their answer" }) }

    perform_enqueued_jobs { export }

    expect(JSON.generate(sent_json)).not_to(match(/theirs|their-page|Their answer|Theirs/))
  end

  it "asks for the password when there is one, and for a recent sign-in when there is not" do
    user.change_password!("a-long-enough-password-1")
    fresh = { "Authorization" => "Bearer #{SessionToken.issue(user.reload)}" }

    expect { export({ current_password: "wrong" }, fresh) }.not_to(have_enqueued_job(SendDataExportJob))
    expect(response).to(have_http_status(:unprocessable_entity))

    expect { export({ current_password: "a-long-enough-password-1" }, fresh) }.to(have_enqueued_job(SendDataExportJob))
    expect(response).to(have_http_status(:accepted))

    passwordless = FactoryBot.create(:user)
    old = { "Authorization" => "Bearer #{travel_to(1.hour.ago) { SessionToken.issue(passwordless) }}" }
    expect { export({}, old) }.not_to(have_enqueued_job(SendDataExportJob))
    expect(response).to(have_http_status(:forbidden))
    expect(JSON.parse(response.body)["error"]).to(eq("reauthentication_required"))
  end

  it "needs a session" do
    export({}, {})
    expect(response).to(have_http_status(:unauthorized))
  end

  it "allows one request a week, counts only the ones that were accepted, and gives the week back to nobody else" do
    Rails.cache.clear
    user.change_password!("a-long-enough-password-1")
    fresh = { "Authorization" => "Bearer #{SessionToken.issue(user.reload)}" }
    export({ current_password: "wrong" }, fresh)
    expect(response).to(have_http_status(:unprocessable_entity))

    export({ current_password: "a-long-enough-password-1" }, fresh)
    expect(response).to(have_http_status(:accepted))
    expect { export({ current_password: "a-long-enough-password-1" }, fresh) }.not_to(have_enqueued_job(SendDataExportJob))
    expect(response).to(have_http_status(:too_many_requests))
    expect(JSON.parse(response.body)["error"]).to(eq("export_weekly_limit"))

    other_headers = { "Authorization" => "Bearer #{SessionToken.issue(other)}" }
    export({}, other_headers)
    expect(response).to(have_http_status(:accepted))

    Rails.cache.delete("data-export:#{user.id}")
    export({ current_password: "a-long-enough-password-1" }, fresh)
    expect(response).to(have_http_status(:accepted))
  end

  it "emails a short notice instead of the data when there is too much, or the file is too big" do
    stub_const("Users::DataExport::MAX_RESPONSES", 1)
    2.times { FormResponse.create!(form: form, answers: { "name0001" => "x" }) }
    perform_enqueued_jobs { export }
    mail = deliveries.find { |item| item.to == [user.email] }
    expect(mail.subject).to(eq("Your Kurz data is too large to send"))
    expect(mail.attachments).to(be_empty)

    deliveries.clear
    Rails.cache.clear
    stub_const("Users::DataExport::MAX_RESPONSES", 50_000)
    stub_const("SendDataExportJob::MAX_BYTES", 10)
    perform_enqueued_jobs { export }
    expect(deliveries.find { |item| item.to == [user.email] }.attachments).to(be_empty)
  end

  it "stays in the queue until there is email budget, however long that takes, and keeps a share for sign-in codes" do
    allow(MailBudget).to(receive(:reserve).and_return(MailBudget::Result.new(ok: false, reason: "daily")))
    8.times do
      expect { SendDataExportJob.perform_now(user.id) }.to(have_enqueued_job(SendDataExportJob).with(user.id))
      clear_enqueued_jobs
    end
    expect(deliveries).to(be_empty)
    expect(MailBudget).to(have_received(:reserve).with(new_address: false, share: SendDataExportJob::BUDGET_SHARE).at_least(:once))

    allow(MailBudget).to(receive(:reserve).and_call_original)
    expect { SendDataExportJob.perform_now(user.id) }.not_to(have_enqueued_job(SendDataExportJob))
    expect(deliveries.find { |item| item.to == [user.email] }.attachments.size).to(eq(1))
  end

  it "does nothing for an account that no longer exists" do
    expect { SendDataExportJob.perform_now(0) }.not_to(raise_error)
    expect(deliveries).to(be_empty)
  end
end
