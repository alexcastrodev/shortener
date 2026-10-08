require "rails_helper"

RSpec.describe("/api/me/bookings", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:owner) { FactoryBot.create(:user) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 5, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"] } }
  let(:form) { Form.create!(user: owner, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:fetch).and_call_original)
    allow(ENV).to(receive(:fetch).with("FRONTEND_URL", anything).and_return("https://kurz.test"))
    travel_to(now)
    current_user.update!(verified_at: now, time_zone: "Europe/Lisbon")
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service] })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email" })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def book(email, *times, date: "2026-11-03", zone: nil)
    answers = { mail_id => email, booking_id => { "service" => service_id, "sessions" => times.map { |time| { "date" => date, "time" => time } } } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_time_zone: zone }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
    Appointment.order(:id).last.group_key
  end

  def book_at(email, *pairs)
    answers = { mail_id => email, booking_id => { "service" => service_id, "sessions" => pairs.map { |date, time| { "date" => date, "time" => time } } } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
    Appointment.order(:id).last.group_key
  end

  def manage_link(group_key)
    post("/api/me/bookings/#{group_key}/manage_link", headers: auth_headers)
  end

  it "answers 401 without a token" do
    get("/api/me/bookings")
    expect(response).to(have_http_status(:unauthorized))
    post("/api/me/bookings/#{SecureRandom.uuid}/manage_link")
    expect(response).to(have_http_status(:unauthorized))
  end

  it "refuses an account whose email is not verified" do
    current_user.update!(verified_at: nil)
    group = book(current_user.email, "09:00")

    get("/api/me/bookings", headers: auth_headers)
    expect(response).to(have_http_status(:forbidden))
    expect(json).to(eq("error" => "email_not_verified"))

    manage_link(group)
    expect(response).to(have_http_status(:forbidden))
    expect(AppointmentToken.count).to(eq(1))
  end

  describe "listing" do
    it "lists only the bookings made with my email, whatever its case, newest first" do
      older = book(current_user.email.upcase, "09:00", "10:00")
      book("someone@example.com", "09:00")
      travel(1.minute)
      newer = book(current_user.email, "09:00", date: "2026-11-04", zone: "America/Sao_Paulo")

      get("/api/me/bookings", headers: auth_headers)

      expect(response).to(have_http_status(:ok))
      expect(json["bookings"].map { |item| item["group_key"] }).to(eq([newer, older]))
      expect(json["bookings"].last).to(eq(
        "group_key" => older,
        "form_title" => "Salon",
        "service" => "Haircut",
        "status" => "confirmed",
        "cancellable" => true,
        "time_zone" => "Europe/Lisbon",
        "series" => false,
        "sessions" => [{ "starts_at" => "2026-11-03T09:00:00Z", "status" => "confirmed" }, { "starts_at" => "2026-11-03T10:00:00Z", "status" => "confirmed" }],
      ))
      expect(json["bookings"].first["time_zone"]).to(eq("America/Sao_Paulo"))
      expect(response.body).not_to(include("someone@example.com"))
    end

    it "shows a cancelled booking as cancelled and no longer cancellable" do
      group = book(current_user.email, "09:00")
      Appointment.where(group_key: group).update_all(status: "cancelled")

      get("/api/me/bookings", headers: auth_headers)
      expect(json["bookings"].first).to(include("status" => "cancelled", "cancellable" => false))
    end

    it "is empty for someone who never booked and keeps to the newest groups" do
      get("/api/me/bookings", headers: auth_headers)
      expect(json).to(eq("bookings" => []))

      stub_const("Appointments::ForClient::LIMIT", 1)
      book(current_user.email, "09:00")
      travel(1.minute)
      newest = book(current_user.email, "10:00")
      get("/api/me/bookings", headers: auth_headers)
      expect(json["bookings"].map { |item| item["group_key"] }).to(eq([newest]))
    end
  end

  describe "listing a range of days for the agenda" do
    def between(from, to)
      get("/api/me/bookings", params: { from: from, to: to }.compact, headers: auth_headers)
    end

    it "returns every booking with a session in the range, with all its sessions, by first session" do
      straddling = book_at(current_user.email, ["2026-11-03", "09:00"], ["2026-11-04", "09:00"])
      travel(1.minute)
      later = book_at(current_user.email.upcase, ["2026-11-05", "10:00"])
      inside = book_at(current_user.email, ["2026-11-05", "09:00"])
      book_at(current_user.email, ["2026-11-12", "09:00"])
      book_at("someone@example.com", ["2026-11-05", "09:00"])

      between("2026-11-04", "2026-11-10")

      expect(response).to(have_http_status(:ok))
      expect(json["bookings"].map { |item| item["group_key"] }).to(eq([straddling, inside, later]))
      expect(json["bookings"].first["sessions"].map { |item| item["starts_at"] }).to(eq(["2026-11-03T09:00:00Z", "2026-11-04T09:00:00Z"]))
      expect(json["bookings"].first.keys).to(match_array(["group_key", "form_title", "service", "status", "cancellable", "time_zone", "series", "sessions"]))

      between("2026-11-06", "2026-11-11")
      expect(json).to(eq("bookings" => []))
    end

    it "reads the days in the account's time zone" do
      current_user.update!(time_zone: "Pacific/Honolulu")
      group = book_at(current_user.email, ["2026-11-03", "09:00"])

      between("2026-11-02", "2026-11-02")
      expect(json["bookings"].map { |item| item["group_key"] }).to(eq([group]))
      between("2026-11-03", "2026-11-03")
      expect(json["bookings"]).to(eq([]))
    end

    it "refuses a range that is not one" do
      [["2026-11-10", "2026-11-04"], ["nov", "2026-11-04"], ["2026-11-04", nil], [nil, "2026-11-04"], ["2026-11-01", "2027-01-02"]].each do |from, to|
        between(from, to)
        expect(response).to(have_http_status(:unprocessable_content), [from, to].inspect)
        expect(json).to(eq("error" => "invalid_range"))
      end
    end

    it "is still closed to an unverified account" do
      current_user.update!(verified_at: nil)
      between("2026-11-04", "2026-11-10")
      expect(response).to(have_http_status(:forbidden))
    end
  end

  describe "manage link" do
    it "hands back a working link for my own booking" do
      group = book(current_user.email, "09:00", "10:00")

      manage_link(group)

      expect(response).to(have_http_status(:ok))
      expect(json["manage_url"]).to(start_with("https://kurz.test/m/"))
      appointment = AppointmentToken.resolve(json["manage_url"][%r{/m/(.+)\z}, 1])
      expect(appointment.group_key).to(eq(group))
      expect(AppointmentToken.last.expires_at).to(eq(Time.utc(2026, 11, 3, 10) + 7.days))
    end

    it "answers 404 for someone else's booking, an unknown one or a malformed key" do
      theirs = book("someone@example.com", "09:00")
      tokens = AppointmentToken.count

      [theirs, SecureRandom.uuid, "nope", "#{theirs}x"].each do |key|
        manage_link(key)
        expect(response).to(have_http_status(:not_found), key)
        expect(json).to(eq("error" => "not_found"))
      end
      expect(AppointmentToken.count).to(eq(tokens))
    end
  end
end
