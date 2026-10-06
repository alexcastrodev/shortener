require "rails_helper"

RSpec.describe("POST /api/public/forms/:public_id/responses", type: :request) do
  let(:owner) { FactoryBot.create(:user) }
  let(:fields) do
    [
      { "id" => "name0001", "type" => "short_text", "label" => "Name", "required" => true },
      { "id" => "mail0001", "type" => "email", "label" => "Mail" },
    ]
  end
  let!(:form) { Form.create!(user: owner, title: "Survey", fields: fields, published: true) }
  let(:json) { JSON.parse(response.body) }
  let(:ip) { "198.51.100.#{rand(1..250)}" }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
  end

  def submit(body = { answers: { "name0001" => "Ana" }, turnstile_token: "t" }, headers: {}, id: form.public_id)
    post("/api/public/forms/#{id}/responses", params: body, headers: { "CF-Connecting-IP" => ip }.merge(headers), as: :json)
  end

  it "stores the answers and answers only { ok: true }" do
    expect { submit({ answers: { "name0001" => "Ana", "mail0001" => "ana@example.com" }, turnstile_token: "t" }) }.to(change(FormResponse, :count).by(1))

    expect(response).to(have_http_status(:created))
    expect(json).to(eq("ok" => true))
    expect(FormResponse.last.answers).to(eq("name0001" => "Ana", "mail0001" => "ana@example.com"))
    expect(form.reload.responses_count).to(eq(1))
  end

  it "keeps only country, device, browser and source, never the IP or raw user agent" do
    submit(
      { answers: { "name0001" => "Ana" }, turnstile_token: "t", referer: "https://www.instagram.com/p/abc?token=SECRET" },
      headers: { "CF-IPCountry" => "PT", "User-Agent" => "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/604.1" },
    )

    stored = FormResponse.last
    expect(stored).to(have_attributes(country: "PT", platform: "iOS", browser: "Safari", source: "Instagram"))
    flat = stored.attributes.values.join(" ")
    ["198.51.100", "Mozilla", "SECRET", "token="].each { |leak| expect(flat).not_to(include(leak)) }
  end

  it "ignores unknown countries" do
    submit(headers: { "CF-IPCountry" => "XX" })
    expect(FormResponse.last.country).to(be_nil)
  end

  it "answers 422 by field id and stores nothing" do
    submit({ answers: { "name0001" => "", "mail0001" => "nope" }, turnstile_token: "t" })

    expect(response).to(have_http_status(:unprocessable_content))
    expect(json).to(eq("errors" => { "answers" => { "name0001" => ["blank"], "mail0001" => ["invalid"] } }))
    expect(FormResponse.count).to(eq(0))
  end

  it "answers 422 when answers is not an object" do
    submit({ answers: "text", turnstile_token: "t" })

    expect(response).to(have_http_status(:unprocessable_content))
    expect(json["errors"]).to(eq("answers" => ["invalid"]))
  end

  it "answers a repeated idempotency key with 200 and one row" do
    body = { answers: { "name0001" => "Ana" }, turnstile_token: "t", idempotency_key: "retry-1" }

    submit(body)
    expect(response).to(have_http_status(:created))
    submit(body)
    expect(response).to(have_http_status(:ok))
    expect(FormResponse.count).to(eq(1))
  end

  it "pretends to succeed on a filled honeypot without storing anything or calling Cloudflare" do
    expect(Turnstile).not_to(receive(:check))

    submit({ answers: { "name0001" => "Ana" }, website: "http://spam.example", turnstile_token: "t" })

    expect(response).to(have_http_status(:created))
    expect(json).to(eq("ok" => true))
    expect(FormResponse.count).to(eq(0))
  end

  describe "Turnstile" do
    it "answers 403 captcha_failed when the token is rejected" do
      allow(Turnstile).to(receive(:check).and_return(:rejected))

      submit

      expect(response).to(have_http_status(:forbidden))
      expect(json).to(eq("error" => "captcha_failed"))
      expect(FormResponse.count).to(eq(0))
    end

    it "checks the form_response action with the visitor's IP" do
      expect(Turnstile).to(receive(:check).with("t", action: "form_response", remote_ip: ip).and_return(:ok))

      submit
    end

    it "accepts up to 5 submissions per IP while Cloudflare is unavailable, then 429" do
      allow(Turnstile).to(receive(:check).and_return(:unavailable))

      5.times { submit }
      expect(FormResponse.count).to(eq(5))
      submit
      expect(response).to(have_http_status(:too_many_requests))
      expect(FormResponse.count).to(eq(5))

      post "/api/public/forms/#{form.public_id}/responses", params: { answers: { "name0001" => "Bo" }, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "203.0.113.9" }, as: :json
      expect(response).to(have_http_status(:created))
    end

    it "does not apply the tighter limit when Cloudflare answers" do
      6.times { submit }

      expect(FormResponse.count).to(eq(6))
    end
  end

  describe "rate limit" do
    it "answers 429 after 30 submissions in 10 minutes from one IP, and only that IP" do
      30.times { submit }
      expect(FormResponse.count).to(eq(30))

      submit
      expect(response).to(have_http_status(:too_many_requests))
      expect(json).to(eq("error" => "rate_limited"))
      expect(FormResponse.count).to(eq(30))

      post "/api/public/forms/#{form.public_id}/responses", params: { answers: { "name0001" => "Bo" }, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "203.0.113.9" }, as: :json
      expect(response).to(have_http_status(:created))
    end
  end

  describe "forms a visitor must not reach" do
    it "answers the same 404 as the read endpoint and stores nothing" do
      draft = Form.create!(user: owner, title: "Draft", fields: fields)
      deleted = Form.create!(user: owner, title: "Gone", fields: fields, published: true).tap(&:destroy!)

      submit(id: "ZZZZZZZZZZZZ")
      missing = [response.status, response.body]
      expect(missing.first).to(eq(404))

      [draft.public_id, deleted.public_id, "x"].each do |id|
        submit(id: id)
        expect([response.status, response.body]).to(eq(missing))
      end
      expect(FormResponse.count).to(eq(0))
    end
  end

  describe "malformed requests" do
    it "answers 413 for a body over 64 KB without storing anything" do
      submit({ answers: { "name0001" => "a" * 70_000 }, turnstile_token: "t" })

      expect(response).to(have_http_status(:payload_too_large))
      expect(FormResponse.count).to(eq(0))
    end

    it "answers 415 for anything but JSON" do
      post "/api/public/forms/#{form.public_id}/responses", params: "answers[name0001]=Ana", headers: { "Content-Type" => "application/x-www-form-urlencoded" }
      expect(response).to(have_http_status(:unsupported_media_type))

      post "/api/public/forms/#{form.public_id}/responses", params: "{}", headers: { "Content-Type" => "text/plain" }
      expect(response).to(have_http_status(:unsupported_media_type))

      post "/api/public/forms/#{form.public_id}/responses"
      expect(response).to(have_http_status(:unsupported_media_type))
      expect(FormResponse.count).to(eq(0))
    end

    it "answers 400 for broken JSON and for a NUL byte" do
      post "/api/public/forms/#{form.public_id}/responses", params: "{not json", headers: { "Content-Type" => "application/json" }
      expect(response).to(have_http_status(:bad_request))

      submit({ answers: { "name0001" => "a\u0000b" }, turnstile_token: "t" })
      expect(response).to(have_http_status(:bad_request))
      expect(FormResponse.count).to(eq(0))
    end

    it "never answers 5xx for odd shapes" do
      [{ answers: nil }, { answers: [1, 2] }, { answers: { "name0001" => { "a" => 1 } } }, { answers: { "name0001" => ["x"] } }, {}, { answers: { "name0001" => "Ana" }, turnstile_token: ["a"], idempotency_key: { "a" => 1 } }].each do |body|
        submit(body)
        expect(response.status).to(be < 500, body.inspect)
      end
    end
  end
end
