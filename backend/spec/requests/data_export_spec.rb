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

  def export(params = {}, hdrs = headers)
    post("/api/me/data_export", params: params, headers: hdrs, as: :json)
  end

  it "downloads everything the user owns as JSON, with choices as labels" do
    FormResponse.create!(form: form, answers: { "name0001" => "Ana", "pick0001" => "choice02", "photo001" => "T" * 24 }, country: "PT", platform: "iOS")

    export

    expect(response).to(have_http_status(:ok))
    expect(response.media_type).to(eq("application/json"))
    expect(response.headers["Content-Disposition"]).to(include("attachment", "kurz-data-"))
    expect(response.headers["Cache-Control"]).to(include("no-store"))
    data = JSON.parse(response.body)
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

    post("/api/me/data_export", params: { current_password: "a-long-enough-password-1" }, headers: { "Authorization" => "Bearer #{SessionToken.issue(user.reload)}" }, as: :json)

    expect(response).to(have_http_status(:ok))
    body = response.body
    ["198.51.100.77", "TOKENTOKEN", "secret-pass", "password_digest", "login_token", "kz_at_", "kz_rt_", user.password_digest.to_s].each { |secret| expect(body).not_to(include(secret), secret) }
    expect(JSON.parse(body)["connected_apps"].first).to(include("client" => "Claude", "scopes" => ["forms:read"]))
  end

  it "contains nothing that belongs to another user" do
    other.shortlinks.create!(original_url: "https://example.com/theirs")
    Page.create!(user: other, slug: "their-page")
    Form.create!(user: other, title: "Theirs", fields: fields).tap { |theirs| FormResponse.create!(form: theirs, answers: { "name0001" => "Their answer" }) }

    export

    expect(response.body).not_to(match(/theirs|their-page|Their answer|Theirs/))
  end

  it "asks for the password when there is one, and for a recent sign-in when there is not" do
    user.change_password!("a-long-enough-password-1")
    fresh = { "Authorization" => "Bearer #{SessionToken.issue(user.reload)}" }

    export({ current_password: "wrong" }, fresh)
    expect(response).to(have_http_status(:unprocessable_entity))

    export({ current_password: "a-long-enough-password-1" }, fresh)
    expect(response).to(have_http_status(:ok))

    passwordless = FactoryBot.create(:user)
    old = { "Authorization" => "Bearer #{travel_to(1.hour.ago) { SessionToken.issue(passwordless) }}" }
    export({}, old)
    expect(response).to(have_http_status(:forbidden))
    expect(JSON.parse(response.body)["error"]).to(eq("reauthentication_required"))
  end

  it "needs a session, refuses oversized accounts and limits how often it runs" do
    export({}, {})
    expect(response).to(have_http_status(:unauthorized))

    stub_const("Users::DataExport::MAX_RESPONSES", 1)
    2.times { FormResponse.create!(form: form, answers: { "name0001" => "x" }) }
    export
    expect(response).to(have_http_status(:payload_too_large))
    expect(JSON.parse(response.body)["error"]).to(eq("export_too_large"))

    3.times { export }
    expect(response).to(have_http_status(:too_many_requests))
  end
end
