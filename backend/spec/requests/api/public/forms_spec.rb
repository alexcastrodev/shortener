require "rails_helper"

RSpec.describe("/api/public/forms", type: :request) do
  let(:owner) { FactoryBot.create(:user) }
  let(:fields) do
    [
      { "id" => "name0001", "type" => "short_text", "label" => "Name", "required" => true, "help" => "Your name" },
      { "id" => "pick0001", "type" => "multiple_choice", "label" => "Pick", "max_choices" => 2, "choices" => [{ "id" => "aaaaaaa1", "label" => "A" }, { "id" => "bbbbbbb2", "label" => "B" }] },
      { "id" => "rate0001", "type" => "rating", "label" => "Rate", "scale" => 5 },
      { "id" => "num00001", "type" => "number", "label" => "Num", "min" => 1, "max" => 9 },
    ]
  end
  let!(:form) { Form.create!(user: owner, title: "Survey", description: "Hi", thank_you_message: "Thanks", theme: "ocean", fields: fields, published: true) }
  let(:json) { JSON.parse(response.body) }

  before do
    host! "localhost"
  end

  it "shows a published form with exactly the public keys" do
    get "/api/public/forms/#{form.public_id}"

    expect(response).to(have_http_status(:ok))
    expect(json.keys).to(eq(["form"]))
    expect(json["form"].keys).to(match_array(["title", "description", "thank_you_message", "theme", "layout", "fields"]))
    expect(json["form"]).to(include("title" => "Survey", "theme" => "ocean"))
    expect(json["form"]["fields"].flat_map(&:keys).uniq).to(match_array(["id", "type", "label", "help", "required", "choices", "max_choices", "scale", "min", "max"]))
    expect(json["form"]["fields"][1]["choices"].first.keys).to(match_array(["id", "label"]))
  end

  it "never exposes ids, the owner, counters, the flag or timestamps" do
    get "/api/public/forms/#{form.public_id}"

    body = response.body
    ["user_id", "responses_count", "published", "created_at", "updated_at", owner.email, "\"id\":#{form.id},", "public_id"].each do |leak|
      expect(body).not_to(include(leak), leak)
    end
  end

  it "answers the same 404 for every state a visitor must not see" do
    unpublished = Form.create!(user: owner, title: "Draft")
    inactive_owner = FactoryBot.create(:user, deactivated_at: Time.current)
    hidden = Form.create!(user: inactive_owner, title: "Hidden", published: true)
    deleted = Form.create!(user: owner, title: "Gone", published: true).tap(&:destroy!)

    get "/api/public/forms/ZZZZZZZZZZZZ"
    missing = [response.status, response.body]
    expect(missing.first).to(eq(404))

    [unpublished.public_id, hidden.public_id, deleted.public_id, "x", "a" * 10_000, "1' OR '1'='1"].each do |id|
      get "/api/public/forms/#{ERB::Util.url_encode(id)}"
      expect([response.status, response.body]).to(eq(missing), id.first(20))
    end
  end

  it "answers 404 for an id that is a path" do
    get "/api/public/forms/..%2f..%2fetc"

    expect(response).to(have_http_status(:not_found))
  end

  it "stops showing a form the moment it is unpublished or deleted" do
    get "/api/public/forms/#{form.public_id}"
    expect(response).to(have_http_status(:ok))

    form.update!(published: false)
    get "/api/public/forms/#{form.public_id}"
    expect(response).to(have_http_status(:not_found))

    form.update!(published: true)
    form.destroy!
    get "/api/public/forms/#{form.public_id}"
    expect(response).to(have_http_status(:not_found))
  end

  it "needs no credentials and sets no cookie" do
    get "/api/public/forms/#{form.public_id}"

    expect(response).to(have_http_status(:ok))
    expect(response.headers["Set-Cookie"]).to(be_nil)
  end
end
