require "rails_helper"

RSpec.describe("public form definition", type: :request) do
  let(:owner) { FactoryBot.create(:user) }
  let!(:form) do
    Form.create!(
      user: owner,
      title: "Draft title",
      fields: [{ "id" => "draft001", "type" => "short_text", "label" => "Draft question" }],
      published: true,
    )
  end
  let(:served) do
    Forms::PublicDefinition.new(
      title: "Served title",
      description: "Served description",
      thank_you_message: "Served thanks",
      theme: "ocean",
      custom_colors: nil,
      layout: "steps",
      fields: [{ "id" => "serve001", "type" => "short_text", "label" => "Served question", "required" => true, "secret" => "x" }],
      published_version: 0,
    )
  end
  let(:json) { JSON.parse(response.body) }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(Forms::PublicDefinition).to(receive(:for).with(form).and_return(served))
  end

  def submit(answers)
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.7" }, as: :json)
  end

  it "serves the public form from the definition, not from the draft columns" do
    get("/api/public/forms/#{form.public_id}")

    expect(response).to(have_http_status(:ok))
    expect(json["form"]).to(include("title" => "Served title", "description" => "Served description", "thank_you_message" => "Served thanks", "theme" => "ocean", "layout" => "steps"))
    expect(json["form"]["fields"].map { |field| field["id"] }).to(eq(["serve001"]))
    expect(json["form"]["fields"].first.keys).not_to(include("secret"))
  end

  it "tells the visitor whether the booking asks to verify the email" do
    booking = { "id" => "book0001", "type" => "booking", "label" => "When", "services" => [], "rules" => { "verify_email" => true, "approval" => "manual" } }
    allow(Forms::PublicDefinition).to(receive(:for).with(form).and_return(served.with(fields: [booking])))
    get("/api/public/forms/#{form.public_id}")
    expect(json["form"]["fields"].first).to(include("verify_email" => true, "waitlist" => false))
    expect(json["form"]["fields"].first.keys).not_to(include("rules"))

    allow(Forms::PublicDefinition).to(receive(:for).with(form).and_return(served.with(fields: [booking.merge("rules" => {})])))
    get("/api/public/forms/#{form.public_id}")
    expect(JSON.parse(response.body)["form"]["fields"].first["verify_email"]).to(be(false))
  end

  it "validates submissions against the same definition" do
    submit({ "draft001" => "ignored" })
    expect(response).to(have_http_status(:unprocessable_content))
    expect(json.dig("errors", "answers")).to(have_key("serve001"))
    expect(FormResponse.count).to(eq(0))

    submit({ "serve001" => "Ana" })
    expect(response).to(have_http_status(:created))
    expect(FormResponse.last.answers).to(eq("serve001" => "Ana"))
  end
end
