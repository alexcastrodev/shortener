require "rails_helper"

RSpec.describe("booking categories", type: :request) do
  include_context "authenticated user"

  let(:form) { Form.create!(user: current_user, title: "Spa") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:massage) { { "id" => "svc00001", "name" => "Massage", "duration" => 60, "days" => ["mon"], "times" => ["09:00"] } }
  let(:facial) { { "id" => "svc00002", "name" => "Facial", "duration" => 30, "days" => ["mon"], "times" => ["10:00"] } }
  let(:categories) { [{ "id" => "cat00001", "name" => "Body" }, { "id" => "cat00002", "name" => "Face" }] }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [massage] })
  end

  def json = JSON.parse(response.body)

  def update(params)
    patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: params, headers: auth_headers, as: :json)
  end

  def stored = form.reload.fields.find { |field| field["type"] == "booking" }

  it "starts without categories, as a plain list of services" do
    expect(stored["categories"]).to(eq([]))
  end

  it "stores categories and the category of each service" do
    update(categories: categories, services: [massage.merge("category_id" => "cat00001"), facial.merge("category_id" => "cat00002")])
    expect(response).to(have_http_status(:ok))
    expect(stored["categories"]).to(eq(categories))
    expect(stored["services"].map { |item| item["category_id"] }).to(eq(["cat00001", "cat00002"]))
  end

  it "needs a category on every service once there are two or more" do
    update(categories: categories, services: [massage.merge("category_id" => "cat00001"), facial])
    expect(response).to(have_http_status(:unprocessable_content))
    expect(stored["categories"]).to(eq([]))
  end

  it "rejects a service pointing at a category that does not exist" do
    update(categories: categories, services: [massage.merge("category_id" => "nope0001"), facial.merge("category_id" => "cat00002")])
    expect(response).to(have_http_status(:unprocessable_content))
  end

  it "accepts a single category, or none, without a category on the services" do
    update(categories: [categories.first], services: [massage, facial])
    expect(response).to(have_http_status(:ok))
    update(categories: [], services: [massage, facial])
    expect(response).to(have_http_status(:ok))
  end

  it "rejects repeated ids, empty names, extra keys and more than ten categories" do
    update(categories: [categories.first, categories.first])
    expect(response).to(have_http_status(:unprocessable_content))
    update(categories: [{ "id" => "cat00003", "name" => "  " }])
    expect(response).to(have_http_status(:unprocessable_content))
    update(categories: Array.new(11) { |index| { "id" => "cat#{format("%05d", index)}", "name" => "C#{index}" } })
    expect(response).to(have_http_status(:unprocessable_content))
  end

  it "gives each new category an id when the client sends none" do
    update(categories: [{ "name" => "Body" }])
    expect(response).to(have_http_status(:ok))
    expect(stored["categories"].first["id"]).to(match(/\A[A-Za-z0-9]{8}\z/))
  end

  it "lets the public form see categories and each service's category, and nothing internal" do
    update(categories: categories, services: [massage.merge("category_id" => "cat00001"), facial.merge("category_id" => "cat00002")], rules: { approval: "manual" })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
    get("/api/public/forms/#{form.public_id}", headers: { "CF-Connecting-IP" => "198.51.100.7" })
    field = json["form"]["fields"].find { |item| item["type"] == "booking" }
    expect(field["categories"]).to(eq(categories))
    expect(field["services"].map { |item| item["category_id"] }).to(eq(["cat00001", "cat00002"]))
    expect(field).not_to(have_key("rules"))
  end
end
