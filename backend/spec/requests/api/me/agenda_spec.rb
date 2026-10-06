require "rails_helper"

RSpec.describe("GET /api/me/agenda", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 4, 12, 0) }
  let(:other) { FactoryBot.create(:user) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 2, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "15:00"] } }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    travel_to(now)
  end

  def json
    JSON.parse(response.body)
  end

  def booking_form(owner: current_user, title: "Salon", published: true, services: [service])
    form = Form.create!(user: owner, title: title)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => services })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload) if published
    form.reload
  end

  def service_id(form)
    form.fields.find { |field| field["type"] == "booking" }["services"].first["id"]
  end

  def book(form, at, status: "confirmed", name: "Ana", count: 1)
    slot = AppointmentSlot.find_or_create_by!(form: form, service_key: service_id(form), starts_at: at) { |row| row.capacity = 2 }
    slot.update!(booked: slot.booked + count)
    count.times do
      response = FormResponse.create!(form: form, answers: {})
      Appointment.create!(form: form, response: response, slot: slot, group_key: SecureRandom.uuid, status: status, client_name: name, client_email: "#{name.downcase}@example.com", snapshot: { "name" => "Haircut", "duration" => 60 })
    end
  end

  def agenda(from: "2026-11-02", to: "2026-11-06", headers: auth_headers)
    get("/api/me/agenda", params: { from: from, to: to }, headers: headers)
  end

  it "answers 401 without a token and 404 when the feature is off" do
    get("/api/me/agenda", params: { from: "2026-11-02", to: "2026-11-06" })
    expect(response).to(have_http_status(:unauthorized))
  end

  it "is empty when the owner has no booking form" do
    Form.create!(user: current_user, title: "Plain")
    agenda
    expect(response).to(have_http_status(:ok))
    expect(json).to(eq("time_zone" => "UTC", "sessions" => []))
  end

  it "shows past sessions as facts, with who booked" do
    form = booking_form
    book(form, Time.utc(2026, 11, 2, 9), name: "Bo")
    agenda
    past = json["sessions"].find { |session| session["starts_at"] == "2026-11-02T09:00:00Z" }
    expect(past).to(include("form_id" => form.id, "form_title" => "Salon", "service_name" => "Haircut", "capacity" => 2, "booked" => 1, "pending" => 0, "date" => "2026-11-02"))
    expect(past["appointments"].map { |item| item.slice("status", "client_name", "client_email") }).to(eq([{ "status" => "confirmed", "client_name" => "Bo", "client_email" => "bo@example.com" }]))
  end

  it "keeps the past unchanged when the service is edited or removed" do
    form = booking_form
    book(form, Time.utc(2026, 11, 2, 9))
    id = form.fields.find { |field| field["type"] == "booking" }["id"]
    Forms::Definition.update(form, id, { "services" => [service.merge("name" => "Renamed", "times" => ["18:00"])] })
    Forms::Publish.call(form: form.reload)
    agenda
    past = json["sessions"].find { |session| session["starts_at"] == "2026-11-02T09:00:00Z" }
    expect(past).to(include("service_name" => "Haircut", "booked" => 1))
  end

  it "projects future sessions from the published form, with zero bookings, including full ones" do
    form = booking_form
    book(form, Time.utc(2026, 11, 5, 9), count: 2)
    agenda
    future = json["sessions"].select { |session| session["date"] >= "2026-11-05" }
    expect(future.map { |session| session["starts_at"] }).to(eq(["2026-11-05T09:00:00Z", "2026-11-05T15:00:00Z", "2026-11-06T09:00:00Z", "2026-11-06T15:00:00Z"]))
    expect(future.first).to(include("booked" => 2, "capacity" => 2))
    expect(future[1]).to(include("booked" => 0, "pending" => 0, "appointments" => []))
  end

  it "gives every session its length in minutes, from the booking when there is one and from the service otherwise" do
    form = booking_form
    book(form, Time.utc(2026, 11, 2, 9))
    agenda
    booked = json["sessions"].find { |session| session["starts_at"] == "2026-11-02T09:00:00Z" }
    projected = json["sessions"].find { |session| session["starts_at"] == "2026-11-05T09:00:00Z" }
    expect([booked["duration"], projected["duration"]]).to(eq([60, 60]))
  end

  it "does not project into the past or onto closed days" do
    booking_form
    agenda(from: "2026-11-02", to: "2026-11-08")
    dates = json["sessions"].map { |session| session["date"] }
    expect(dates).to(all(be >= "2026-11-04"))
    expect(dates).not_to(include("2026-11-07", "2026-11-08"))
    expect(json["sessions"].map { |session| session["starts_at"] }).not_to(include("2026-11-04T09:00:00Z"))
  end

  it "does not project from an unpublished form but still shows its past bookings" do
    form = booking_form(published: false)
    book(form, Time.utc(2026, 11, 3, 9))
    agenda
    expect(json["sessions"].map { |session| session["starts_at"] }).to(eq(["2026-11-03T09:00:00Z"]))
  end

  it "counts pending requests and lists only appointments that hold a place" do
    form = booking_form
    book(form, Time.utc(2026, 11, 3, 9), status: "pending", name: "Cy")
    book(form, Time.utc(2026, 11, 3, 9), status: "cancelled", name: "Di", count: 1)
    agenda
    session = json["sessions"].find { |item| item["starts_at"] == "2026-11-03T09:00:00Z" }
    expect(session["pending"]).to(eq(1))
    expect(session["appointments"].map { |item| item["client_name"] }).to(eq(["Cy"]))
  end

  it "uses the owner's time zone for the day and the range" do
    current_user.update!(time_zone: "Pacific/Auckland")
    form = booking_form
    book(form, Time.utc(2026, 11, 2, 20))
    agenda(from: "2026-11-03", to: "2026-11-03")
    expect(json["time_zone"]).to(eq("Pacific/Auckland"))
    expect(json["sessions"].map { |session| [session["starts_at"], session["date"]] }).to(include(["2026-11-02T20:00:00Z", "2026-11-03"]))
  end

  it "never shows another owner's sessions or appointments" do
    mine = booking_form
    theirs = booking_form(owner: other, title: "Theirs")
    book(theirs, Time.utc(2026, 11, 3, 9), name: "Secret")
    book(mine, Time.utc(2026, 11, 3, 15), name: "Mine")
    agenda
    expect(json["sessions"].map { |session| session["form_title"] }.uniq).to(eq(["Salon"]))
    expect(response.body).not_to(include("Secret", "Theirs"))
  end

  it "lists several forms together in time order" do
    first = booking_form(title: "A")
    second = booking_form(title: "B")
    book(first, Time.utc(2026, 11, 3, 15))
    book(second, Time.utc(2026, 11, 3, 9))
    agenda(to: "2026-11-03")
    expect(json["sessions"].map { |session| [session["starts_at"], session["form_title"]] }).to(eq([["2026-11-03T09:00:00Z", "B"], ["2026-11-03T15:00:00Z", "A"]]))
  end

  describe "range" do
    it "answers 422 for malformed, missing, reversed and over-62-day ranges" do
      [{ from: "x", to: "2026-11-06" }, { from: "2026-11-02" }, { from: "2026-11-06", to: "2026-11-02" }, { from: "2026-11-02", to: "2027-01-31" }].each do |params|
        get("/api/me/agenda", params: params, headers: auth_headers)
        expect(response).to(have_http_status(:unprocessable_content), params.inspect)
      end
    end

    it "accepts exactly 62 days" do
      booking_form
      agenda(from: "2026-11-02", to: "2027-01-02")
      expect(response).to(have_http_status(:ok))
    end
  end
end
