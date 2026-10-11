require "rails_helper"

RSpec.describe("reports of a booking question without a label", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:service) { { name: "Haircut", duration: 60, capacity: 1, days: ["mon", "tue", "wed"], times: ["09:00", "10:00"] } }
  let(:booking_id) { stored_booking["id"] }
  let(:service_id) { stored_booking["services"].first["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(Turnstile).to(receive(:check).and_return(:ok))
    travel_to(now)
    post("/api/me/forms/#{form.id}/fields", params: { type: "booking", services: [service] }, headers: auth_headers, as: :json)
    post("/api/me/forms/#{form.id}/fields", params: { type: "short_text", label: "Name", required: true }, headers: auth_headers, as: :json)
    post("/api/me/forms/#{form.id}/publish", headers: auth_headers)
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: { name_id => "Ana", booking_id => { "service" => service_id, "sessions" => [{ "date" => "2026-11-03", "time" => "09:00" }] } }, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.7" }, as: :json)
  end

  def json
    JSON.parse(response.body)
  end

  def stored_booking
    form.reload.fields.find { |field| field["type"] == "booking" }
  end

  it "serves responses and the summary with the question label left empty for the app to name" do
    get("/api/me/forms/#{form.id}/responses", headers: auth_headers)
    expect(response).to(have_http_status(:ok))
    answer = json["response"].first["answers"].find { |item| item["id"] == booking_id }
    expect(answer).to(include("type" => "booking", "label" => nil))

    get("/api/me/forms/#{form.id}/summary", headers: auth_headers)
    expect(response).to(have_http_status(:ok))
    expect(json["fields"].find { |item| item["id"] == booking_id }).to(include("type" => "booking", "label" => nil, "answered" => 1))
  end

  it "names the question in the spreadsheet and in the personal data export" do
    sheet = Forms::Export.call(form: form.reload)
    entries = {}
    Zip::InputStream.open(StringIO.new(sheet)) do |zip|
      while (entry = zip.get_next_entry)
        entries[entry.name] = zip.read
      end
    end
    text = entries["xl/worksheets/sheet1.xml"] + entries["xl/sharedStrings.xml"].to_s
    expect(text).to(include("Booking", "2026-11-03 09:00"))

    exported = Users::DataExport.call(user: current_user)
    answers = exported[:forms].first[:responses].first[:answers]
    expect(answers.keys).to(contain_exactly("Name", "Booking"))
  end

  it "names the answer in the connected apps without crashing on a missing label" do
    row = form.responses.last

    json = Mcp::Tools::ResponseToolHelpers.response_json(form.reload, row, { response: 1000, page: 1000 })
    expect(json[:answers].map { |item| item[:question] }).to(contain_exactly("Name", "Booking"))

    field_json = Mcp::Tools::FormToolHelpers.field_json(stored_booking)
    expect(field_json["label"]).to(eq(""))
  end
end
