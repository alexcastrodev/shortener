require "rails_helper"
require "zip"

RSpec.describe("Form responses export", type: :request) do
  let(:user) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:headers) { { "Authorization" => "Bearer #{SessionToken.issue(user)}" } }
  let(:fields) do
    [
      { "id" => "name0001", "type" => "short_text", "label" => "Name" },
      { "id" => "pick0001", "type" => "single_choice", "label" => "Pick", "choices" => [{ "id" => "choice01", "label" => "Red" }, { "id" => "choice02", "label" => "Blue" }] },
      { "id" => "many0001", "type" => "multiple_choice", "label" => "Many", "choices" => [{ "id" => "choice01", "label" => "Red" }, { "id" => "choice02", "label" => "Blue" }] },
      { "id" => "yes00001", "type" => "yes_no", "label" => "Agree" },
      { "id" => "rate0001", "type" => "rating", "label" => "Stars", "scale" => 5 },
      { "id" => "photo001", "type" => "image", "label" => "Photo" },
    ]
  end
  let!(:form) { Form.create!(user: user, title: "My: survey/2026", fields: fields) }

  before { host! "localhost" }

  def sheet_of(body)
    entries = {}
    Zip::InputStream.open(StringIO.new(body)) do |zip|
      while (entry = zip.get_next_entry)
        entries[entry.name] = zip.read
      end
    end
    entries
  end

  def export(params = {}, hdrs = headers, target = form)
    get("/api/me/forms/#{target.id}/responses_export", params: params, headers: hdrs)
  end

  it "returns an Excel workbook with a header and one row per response, choices as labels" do
    FormResponse.create!(form: form, answers: { "name0001" => "Ana", "pick0001" => "choice01", "many0001" => ["choice01", "choice02"], "yes00001" => true, "rate0001" => 4, "photo001" => "T" * 24 }, country: "PT", platform: "iOS", browser: "Safari", source: "Direct")

    export

    expect(response).to(have_http_status(:ok))
    expect(response.media_type).to(eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
    expect(response.headers["Content-Disposition"]).to(include("attachment", "my-survey-2026-responses.xlsx"))
    expect(response.headers["Cache-Control"]).to(include("no-store"))
    entries = sheet_of(response.body)
    sheet = entries["xl/worksheets/sheet1.xml"]
    shared = entries["xl/sharedStrings.xml"].to_s
    text = sheet + shared
    ["Submitted", "Name", "Ana", "Red", "Red, Blue", "Yes", "Image", "Safari", "PT"].each { |expected| expect(text).to(include(expected), expected) }
    expect(text).not_to(include("TTTTTTTT"))
    expect(entries["xl/workbook.xml"]).to(include("My  survey 2026"))
    expect(sheet.scan("<row ").size).to(eq(2))
  end

  it "writes hostile cell text as plain strings, never as formulas" do
    payloads = ["=HYPERLINK(\"http://evil.test\",\"x\")", "+cmd|' /C calc'!A0", "-2+3", "@SUM(1+1)", "=1+1"]
    payloads.each { |payload| FormResponse.create!(form: form, answers: { "name0001" => payload }) }
    form.update!(fields: [{ "id" => "name0001", "type" => "short_text", "label" => "=SUM(A1)" }])

    export

    entries = sheet_of(response.body)
    sheet = entries["xl/worksheets/sheet1.xml"]
    expect(sheet).not_to(include("<f>"))
    expect(sheet).not_to(include("<f "))
    expect(entries.values.join).not_to(match(/<f[ >]/))
    document = Nokogiri::XML(sheet).remove_namespaces!
    expect(document.xpath("//c[@t='inlineStr']/is/t").map(&:text)).to(include("=SUM(A1)", *payloads))
    expect(document.xpath("//f")).to(be_empty)
  end

  it "filters by period like the responses page" do
    FormResponse.create!(form: form, answers: { "name0001" => "old" }, created_at: 40.days.ago)
    FormResponse.create!(form: form, answers: { "name0001" => "new" })

    export({ days: 7 })

    sheet = sheet_of(response.body)["xl/worksheets/sheet1.xml"]
    expect(sheet).to(include("new"))
    expect(sheet).not_to(include("old"))
  end

  it "keeps tenants apart and needs a session" do
    export({}, {})
    expect(response).to(have_http_status(:unauthorized))

    export({}, { "Authorization" => "Bearer #{SessionToken.issue(other)}" })
    expect(response).to(have_http_status(:not_found))
  end

  it "refuses to build a workbook past the row cap and limits how often exports run" do
    stub_const("Forms::Export::MAX_ROWS", 2)
    3.times { FormResponse.create!(form: form, answers: { "name0001" => "x" }) }

    export

    expect(response).to(have_http_status(:payload_too_large))
    expect(JSON.parse(response.body)["error"]).to(eq("export_too_large"))

    10.times { export }
    expect(response).to(have_http_status(:too_many_requests))
  end
end
