require "rails_helper"

RSpec.describe("GET /api/me appointments flag", type: :request) do
  include_context "authenticated user"

  before { host! "localhost" }

  def flag
    get("/api/me", headers: auth_headers)
    expect(response).to(have_http_status(:ok))
    JSON.parse(response.body).dig("user", "appointments_enabled")
  end

  def configure(enabled:, emails: nil)
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(enabled))
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ALLOWED_EMAILS").and_return(emails))
  end

  it "is false when the flag is off, even for a listed user" do
    configure(enabled: nil, emails: current_user.email)
    expect(flag).to(be(false))
  end

  it "is false for a user outside the allow-list" do
    configure(enabled: "true", emails: "someone@else.com")
    expect(flag).to(be(false))
  end

  it "is true for a listed user, ignoring case and spaces" do
    configure(enabled: "true", emails: " other@x.com , #{current_user.email.upcase} ")
    expect(flag).to(be(true))
  end

  it "is true for everyone when the flag is on and the list is empty" do
    configure(enabled: "true", emails: nil)
    expect(flag).to(be(true))
  end

  it "is not exposed to anonymous callers" do
    get("/api/me")
    expect(response).to(have_http_status(:unauthorized))
  end
end
