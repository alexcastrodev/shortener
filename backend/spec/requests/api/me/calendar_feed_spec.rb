require "rails_helper"

RSpec.describe("the signed calendar feed", type: :request) do
  include_context "authenticated user"

  let(:other) { FactoryBot.create(:user) }
  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 45, "capacity" => 2, "days" => ["tue", "wed"], "times" => ["09:00", "10:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon, North; Branch") }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service] })
  end

  def json = JSON.parse(response.body)

  def book(target, name:, at:, status: "confirmed", duration: 45, service_name: "Haircut")
    key = target.fields.find { |field| field["type"] == "booking" }["services"].first["id"]
    slot = AppointmentSlot.find_or_create_by!(form: target, service_key: key, starts_at: at) { |row| row.capacity = 5 }
    slot.update!(booked: slot.booked + 1)
    Appointment.create!(form: target, response: FormResponse.create!(form: target, answers: {}), slot: slot, group_key: SecureRandom.uuid, status: status, client_name: name, client_email: "x@example.com", snapshot: { "name" => service_name, "duration" => duration })
  end

  def enable
    post("/api/me/calendar_feed", headers: auth_headers)
    json["url"]
  end

  def feed(url, **options)
    get(URI(url).path, **options)
  end

  describe "turning it on, off and over" do
    it "needs a token and the feature" do
      post("/api/me/calendar_feed")
      expect(response).to(have_http_status(:unauthorized))
      get("/api/me/calendar_feed")
      expect(response).to(have_http_status(:unauthorized))
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      post("/api/me/calendar_feed", headers: auth_headers)
      expect(response).to(have_http_status(:not_found))
    end

    it "gives a secret address once and stores only its digest" do
      get("/api/me/calendar_feed", headers: auth_headers)
      expect(json).to(include("enabled" => false))
      url = enable
      expect(response).to(have_http_status(:created))
      raw = url.split("/").last
      expect(raw).to(match(/\A[A-Za-z0-9_-]{43}\z/))
      expect(CalendarFeed.pluck(:digest)).to(all(match(/\A\h{64}\z/)).and(satisfy { |digests| digests.exclude?(raw) }))
      get("/api/me/calendar_feed", headers: auth_headers)
      expect(json).to(include("enabled" => true))
      expect(response.body).not_to(include(raw))
    end

    it "replaces the address when asked again, and the old one stops working" do
      first = enable
      second = enable
      expect(second).not_to(eq(first))
      feed(first)
      expect(response).to(have_http_status(:not_found))
      feed(second)
      expect(response).to(have_http_status(:ok))
      expect(CalendarFeed.where(user_id: current_user.id).count).to(eq(1))
    end

    it "revokes the address" do
      url = enable
      delete("/api/me/calendar_feed", headers: auth_headers)
      expect(response).to(have_http_status(:no_content))
      feed(url)
      expect(response).to(have_http_status(:not_found))
      delete("/api/me/calendar_feed", headers: auth_headers)
      expect(response).to(have_http_status(:no_content))
    end

    it "keeps every owner's address to that owner" do
      url = enable
      post("/api/me/calendar_feed", headers: { "Authorization" => "Bearer #{SessionToken.issue(other)}" })
      expect(CalendarFeed.count).to(eq(2))
      feed(url)
      expect(response.body).to(include("Kurz"))
      expect(CalendarFeed.find_by(user_id: other.id).digest).not_to(eq(CalendarFeed.find_by(user_id: current_user.id).digest))
    end
  end

  describe "the calendar" do
    it "lists confirmed sessions only, in UTC, with the service length, and nothing from other owners" do
      book(form, name: "Ana", at: Time.utc(2026, 11, 3, 9))
      book(form, name: "Pending", at: Time.utc(2026, 11, 3, 10), status: "pending")
      book(form, name: "Cancelled", at: Time.utc(2026, 11, 3, 11), status: "cancelled")
      theirs = Form.create!(user: other, title: "Other")
      Forms::Definition.add(theirs, { "type" => "booking", "label" => "When", "services" => [service] })
      book(theirs.reload, name: "Stranger", at: Time.utc(2026, 11, 3, 12))
      feed(enable)

      expect(response).to(have_http_status(:ok))
      expect(response.media_type).to(eq("text/calendar"))
      expect(response.headers["Cache-Control"]).to(include("no-store"))
      body = response.body
      expect(body).to(start_with("BEGIN:VCALENDAR\r\n"))
      expect(body).to(end_with("END:VCALENDAR\r\n"))
      expect(body.scan("BEGIN:VEVENT").size).to(eq(1))
      expect(body).to(include("DTSTART:20261103T090000Z", "DTEND:20261103T094500Z", "STATUS:CONFIRMED"))
      expect(body).to(include("SUMMARY:Haircut · Ana"))
      expect(body).not_to(include("Pending", "Cancelled", "Stranger"))
    end

    it "keeps one stable id per appointment and only a window of time" do
      near = book(form, name: "Near", at: Time.utc(2026, 11, 3, 9))
      book(form, name: "Old", at: Time.utc(2026, 9, 1, 9))
      book(form, name: "Far", at: Time.utc(2028, 1, 4, 9))
      feed(enable)
      expect(response.body).to(include("UID:appointment-#{near.id}@kurz.fyi"))
      expect(response.body).not_to(include("Old", "Far"))
    end

    it "never lets a client's name break a line, add a property or run past 75 bytes" do
      book(form, name: "Ana\r\nATTENDEE:mailto:evil@example.com\nBEGIN:VEVENT; x, y \\ z" + ("é" * 80), at: Time.utc(2026, 11, 3, 9))
      feed(enable)
      lines = response.body.split("\r\n")
      expect(lines.none? { |line| line.start_with?("ATTENDEE") }).to(be(true))
      expect(lines.count("BEGIN:VEVENT")).to(eq(1))
      expect(lines.map(&:bytesize).max).to(be <= 75)
      unfolded = response.body.gsub("\r\n ", "")
      expect(unfolded).to(include("\\;", "\\,", "\\\\"))
      expect(unfolded).to(include("DESCRIPTION:Salon\\, North\\; Branch"))
    end

    it "says nothing about itself to a stranger: a wrong, a malformed and a revoked address answer alike" do
      url = enable
      feed("https://x/api/public/calendar/#{"a" * 43}")
      unknown = [response.status, response.body]
      ["short", "a" * 44, "a-" * 22, url.split("/").last.reverse].each do |guess|
        feed("https://x/api/public/calendar/#{guess}")
        expect([response.status, response.body]).to(eq(unknown), guess)
      end
      expect(unknown.first).to(eq(404))
    end

    it "stops for a deactivated owner and when the feature is off, and notes when it was read" do
      url = enable
      expect(CalendarFeed.last.last_fetched_at).to(be_nil)
      feed(url)
      expect(CalendarFeed.last.last_fetched_at).to(be_present)
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      feed(url)
      expect(response).to(have_http_status(:not_found))
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
      current_user.update_columns(deactivated_at: Time.current)
      feed(url)
      expect(response).to(have_http_status(:not_found))
    end

    it "limits reads per address" do
      url = enable
      60.times { feed(url, headers: { "CF-Connecting-IP" => "203.0.113.90" }) }
      feed(url, headers: { "CF-Connecting-IP" => "203.0.113.90" })
      expect(response).to(have_http_status(:too_many_requests))
    end

    it "is gone with the account" do
      enable
      expect { current_user.destroy! }.to(change(CalendarFeed, :count).by(-1))
    end
  end
end
