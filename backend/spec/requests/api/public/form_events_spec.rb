require "rails_helper"

RSpec.describe("POST /api/public/forms/:public_id/events", type: :request) do
  let(:owner) { FactoryBot.create(:user) }
  let!(:form) { Form.create!(user: owner, title: "Survey", published: true) }
  let(:ip) { "198.51.100.#{rand(1..250)}" }

  before do
    host! "localhost"
  end

  def track(body = { event: "view" }, id: form.public_id, headers: {})
    post("/api/public/forms/#{id}/events", params: body, headers: { "CF-Connecting-IP" => ip }.merge(headers), as: :json)
  end

  it "answers 204 and counts the view and the start" do
    track
    expect(response).to(have_http_status(:no_content))
    expect(response.body).to(be_empty)
    track({ event: "start" })

    expect(FormDailyStat.find_by(form_id: form.id)).to(have_attributes(views: 1, starts: 1, unique_views: 1))
  end

  it "answers 422 for an unknown event and counts nothing" do
    track({ event: "purchase" })

    expect(response).to(have_http_status(:unprocessable_content))
    expect(JSON.parse(response.body)).to(eq("error" => "invalid_event"))
    expect(FormDailyStat.count).to(eq(0))
  end

  it "answers the same 404 as the other public endpoints and counts nothing" do
    draft = Form.create!(user: owner, title: "Draft")

    track(id: "ZZZZZZZZZZZZ")
    missing = [response.status, response.body]
    expect(missing.first).to(eq(404))

    [draft.public_id, "x"].each do |id|
      track(id: id)
      expect([response.status, response.body]).to(eq(missing))
    end
    expect(FormDailyStat.count).to(eq(0))
  end

  it "sets no cookie and needs no credentials" do
    track

    expect(response.headers["Set-Cookie"]).to(be_nil)
  end

  it "answers 415 for non-JSON, 413 for an oversized body and 400 for broken JSON or NUL" do
    post "/api/public/forms/#{form.public_id}/events", params: "event=view", headers: { "Content-Type" => "application/x-www-form-urlencoded" }
    expect(response).to(have_http_status(:unsupported_media_type))

    track({ event: "view", pad: "a" * 2_000 })
    expect(response).to(have_http_status(:payload_too_large))

    post "/api/public/forms/#{form.public_id}/events", params: "{nope", headers: { "Content-Type" => "application/json" }
    expect(response).to(have_http_status(:bad_request))

    track({ event: "vi\u0000ew" })
    expect(response).to(have_http_status(:bad_request))
    expect(FormDailyStat.count).to(eq(0))
  end

  it "never answers 5xx for odd shapes" do
    [{}, { event: nil }, { event: ["view"] }, { event: { "a" => 1 } }, { event: 5 }].each do |body|
      track(body)
      expect(response.status).to(be < 500, body.inspect)
    end
  end

  it "answers 429 after 60 events a minute from one IP" do
    60.times { track }
    expect(response).to(have_http_status(:no_content))

    track
    expect(response).to(have_http_status(:too_many_requests))

    post "/api/public/forms/#{form.public_id}/events", params: { event: "view" }, headers: { "CF-Connecting-IP" => "203.0.113.9" }, as: :json
    expect(response).to(have_http_status(:no_content))
  end
end
