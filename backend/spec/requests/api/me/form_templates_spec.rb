require "rails_helper"

RSpec.describe("/api/me/form_templates", type: :request) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  it "requires authentication" do
    get "/api/me/form_templates"

    expect(response).to(have_http_status(:unauthorized))
  end

  it "lists the built-in templates without their questions" do
    get "/api/me/form_templates", headers: auth_headers

    expect(response).to(have_http_status(:ok))
    templates = JSON.parse(response.body)["form_template"]
    expect(templates.map { |t| t["id"] }).to(match_array(BuiltInFormTemplates.all.map { |t| t["id"] }))
    expect(templates.first.keys).to(match_array(["id", "name", "description", "theme", "questions"]))
    expect(templates.map { |t| t["questions"] }).to(all(be_positive))
  end
end
