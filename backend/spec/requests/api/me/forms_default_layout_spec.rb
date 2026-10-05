require "rails_helper"

RSpec.describe("default form layout", type: :request) do
  include_context "authenticated user"

  let(:json) { JSON.parse(response.body) }

  before { host! "localhost" }

  it "opens a new form as a single page" do
    post("/api/me/forms", params: { title: "Contact" }, headers: auth_headers, as: :json)
    expect(response).to(have_http_status(:created))
    expect(json.dig("form", "layout")).to(eq("page"))
  end

  it "opens a form built from a template as a single page" do
    post("/api/me/forms", params: { title: "Feedback", template: "contact" }, headers: auth_headers, as: :json)
    expect(response).to(have_http_status(:created))
    expect(json.dig("form", "layout")).to(eq("page"))
  end

  it "keeps a layout chosen on creation" do
    post("/api/me/forms", params: { title: "Chat", layout: "one_at_a_time" }, headers: auth_headers, as: :json)
    expect(json.dig("form", "layout")).to(eq("one_at_a_time"))
  end

  it "does not change forms that already exist" do
    form = Form.create!(user: current_user, title: "Old", layout: "one_at_a_time")
    get("/api/me/forms/#{form.id}", headers: auth_headers)
    expect(json.dig("form", "layout")).to(eq("one_at_a_time"))
  end

  it "keeps the layout of the original when duplicating" do
    form = Form.create!(user: current_user, title: "Old", layout: "steps")
    post("/api/me/forms/#{form.id}/duplicate", headers: auth_headers)
    expect(json.dig("form", "layout")).to(eq("steps"))
  end
end
