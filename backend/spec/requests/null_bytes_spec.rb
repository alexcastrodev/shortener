require "rails_helper"

RSpec.describe("NUL bytes in input", type: :request) do
  include_context "authenticated user"

  before do
    host! "localhost"
  end

  it "answers 400, never 500, for NUL in a public path" do
    ["/api/public/shortlinks/%00", "/api/public/shortlinks/ab%00cd", "/api/public/pages/%00", "/api/public/forms/%00", "/api/public/forms/ab%00cd"].each do |path|
      get path
      expect(response).to(have_http_status(:bad_request), path)
    end
    post "/api/public/shortlinks/%00/unlock", params: { password: "x" }
    expect(response).to(have_http_status(:bad_request))
  end

  it "answers 400 for NUL in a query string" do
    get "/api/me/shortlinks", params: { q: "a\u0000b" }, headers: auth_headers
    expect(response).to(have_http_status(:bad_request))
  end

  it "answers 400 for NUL anywhere in a JSON body, however deep" do
    post "/api/me/forms", params: { title: "a\u0000b" }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:bad_request))

    post "/api/me/forms", params: { title: "ok", nested: { list: [{ deep: "x\u0000" }] } }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:bad_request))

    post "/api/me/shortlinks", params: { original_url: "https://example.com/\u0000", title: "t" }, headers: auth_headers, as: :json
    expect(response).to(have_http_status(:bad_request))
    expect(Form.count).to(eq(0))
  end

  it "still serves normal requests" do
    get "/api/public/shortlinks/abcdef"
    expect(response).to(have_http_status(:not_found))
  end
end
