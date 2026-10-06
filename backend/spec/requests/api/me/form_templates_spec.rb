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

  it "lists and builds the templates in the owner's language" do
    current_user.update!(locale: "pt-PT")
    get "/api/me/form_templates", headers: auth_headers
    expect(JSON.parse(response.body)["form_template"].map { |t| t["name"] }).to(include("Contacto", "Lista de espera"))

    post "/api/me/forms", params: { title: "O meu contacto", template: "contact" }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:created))
    form = JSON.parse(response.body)["form"]
    expect(form["title"]).to(eq("O meu contacto"))
    expect(form["fields"].map { |f| f["label"] }).to(eq(["O seu nome", "O seu e-mail", "Em que podemos ajudar?"]))

    post "/api/me/forms/#{form["id"]}/apply_template", params: { template: "event_rsvp" }, headers: auth_headers, as: :json
    expect(JSON.parse(response.body)["form"]["fields"].map { |f| f["label"] }).to(include("Vai comparecer?"))
  end

  it "follows the language the page is shown in, when the owner never saved one, and ignores an unknown one" do
    get "/api/me/form_templates", params: { locale: "pt-PT" }, headers: auth_headers
    expect(JSON.parse(response.body)["form_template"].map { |t| t["name"] }).to(include("Contacto"))
    get "/api/me/form_templates", params: { locale: "xx" }, headers: auth_headers
    expect(JSON.parse(response.body)["form_template"].map { |t| t["name"] }).to(include("Contact"))

    post "/api/me/forms", params: { title: "Meu", template: "contact", locale: "pt-PT" }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:created))
    expect(JSON.parse(response.body)["form"]["fields"].first["label"]).to(eq("O seu nome"))
  end

  it "stays in English for an owner without a language, and for an AI app" do
    get "/api/me/form_templates", headers: auth_headers
    expect(JSON.parse(response.body)["form_template"].map { |t| t["name"] }).to(include("Contact"))
  end
end
