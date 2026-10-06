require "rails_helper"

RSpec.describe("the waiting list", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"] } }
  let(:rules) { { "approval" => "auto", "waitlist" => true, "waitlist_confirm_minutes" => 60 } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
  let(:other) { FactoryBot.create(:user) }
  let(:deliveries) { ActionMailer::Base.deliveries }

  around do |example|
    previous = ENV["GMAIL_USERNAME"]
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    example.run
  ensure
    ENV["GMAIL_USERNAME"] = previous
  end

  before do
    host! "localhost"
    deliveries.clear
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:fetch).and_call_original)
    allow(ENV).to(receive(:fetch).with("FRONTEND_URL", anything).and_return("https://kurz.test"))
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => rules })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def book(name: "Ana", time: "09:00", date: "2026-11-03")
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => [{ "date" => date, "time" => time }] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def join(name: "Bo", email: nil, time: "09:00", date: "2026-11-03", extra: {})
    post("/api/public/forms/#{form.public_id}/waitlist", params: { service: service_id, date: date, time: time, name: name, email: email || "#{name.downcase}@example.com", turnstile_token: "t" }.merge(extra), headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def slot = AppointmentSlot.find_by(starts_at: Time.utc(2026, 11, 3, 9))

  def entry(name = "Bo") = WaitlistEntry.find_by(name: name)

  def cancel_booking(row = Appointment.order(:id).first)
    token = AppointmentToken.issue(booking: row, expires_at: now + 30.days)
    post("/api/public/appointments/#{token}/cancel", as: :json)
  end

  def token_of(name = "Bo") = entry(name).token

  describe "joining" do
    before { book }

    it "puts someone on the list of a full time and emails them how to leave" do
      perform_enqueued_jobs { join }
      expect(response).to(have_http_status(:created))
      expect(entry).to(have_attributes(status: "waiting", email: "bo@example.com", starts_at: Time.utc(2026, 11, 3, 9)))
      mail = deliveries.find { |item| item.to == ["bo@example.com"] }
      expect(mail.text_part.body.to_s).to(include("https://kurz.test/w/"))
      expect(slot).to(have_attributes(booked: 1, held: 0))
    end

    it "is not needed when the time has room: it says so" do
      join(time: "10:00")
      expect(response).to(have_http_status(:conflict))
      expect(json["error"]).to(eq("not_full"))
      expect(WaitlistEntry.count).to(eq(0))
    end

    it "refuses a time the service does not offer, a service that is unknown and bad dates" do
      join(time: "13:00")
      expect(response).to(have_http_status(:unprocessable_content))
      join(date: "2026-11-07")
      expect(response).to(have_http_status(:unprocessable_content))
      join(date: "nov")
      expect(response).to(have_http_status(:unprocessable_content))
      post("/api/public/forms/#{form.public_id}/waitlist", params: { service: "nope0000", date: "2026-11-03", time: "09:00", name: "Bo", email: "bo@example.com" }, as: :json)
      expect(response).to(have_http_status(:unprocessable_content))
      expect(WaitlistEntry.count).to(eq(0))
    end

    it "needs a name and a real email, and cleans the name" do
      join(name: "  ")
      expect(response).to(have_http_status(:unprocessable_content))
      join(email: "not-an-email")
      expect(response).to(have_http_status(:unprocessable_content))
      join(name: "Bo\r\nBcc: evil@example.com", email: "evil@example.com")
      expect(response).to(have_http_status(:created))
      expect(WaitlistEntry.last.name).not_to(match(/[\r\n]/))
    end

    it "keeps one place per person: joining again changes nothing" do
      join
      join
      expect(response).to(have_http_status(:created))
      expect(WaitlistEntry.count).to(eq(1))
      join(email: "BO@example.com")
      expect(WaitlistEntry.count).to(eq(1))
    end

    it "limits the list of one time and the lists of one person" do
      stub_const("Appointments::Waitlist::MAX_WAITING", 2)
      join(name: "Cy")
      join(name: "Di")
      join(name: "Ed")
      expect(response).to(have_http_status(:conflict))
      expect(json["error"]).to(eq("waitlist_full"))
      stub_const("Appointments::Waitlist::MAX_WAITING", 20)
      stub_const("Appointments::Waitlist::MAX_PER_EMAIL", 1)
      book(name: "Zed", time: "10:00")
      join(name: "Fy", email: "cy@example.com", time: "10:00")
      expect(response).to(have_http_status(:too_many_requests))
    end

    it "is off unless the form turns it on, and off with the feature" do
      Forms::Definition.update(form, booking_id, { "rules" => { "waitlist" => false } })
      Forms::Publish.call(form: form.reload)
      join
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "refuses a failed human check, swallows the trap field, and limits tries per address" do
      allow(Turnstile).to(receive(:check).and_return(:rejected))
      join
      expect(response).to(have_http_status(:forbidden))
      allow(Turnstile).to(receive(:check).and_return(:ok))
      join(extra: { website: "http://spam" })
      expect(WaitlistEntry.count).to(eq(0))
      10.times { |index| post("/api/public/forms/#{form.public_id}/waitlist", params: { service: service_id, date: "2026-11-03", time: "09:00", name: "N#{index}", email: "n#{index}@example.com" }, headers: { "CF-Connecting-IP" => "203.0.113.40" }, as: :json) }
      post("/api/public/forms/#{form.public_id}/waitlist", params: { service: service_id, date: "2026-11-03", time: "09:00", name: "Late", email: "late@example.com" }, headers: { "CF-Connecting-IP" => "203.0.113.40" }, as: :json)
      expect(response).to(have_http_status(:too_many_requests))
    end

    it "judges full by the capacity the service has now, even if it was lowered after bookings were made" do
      Forms::Definition.update(form, booking_id, { "services" => [service.merge("id" => service_id, "capacity" => 2)] })
      Forms::Publish.call(form: form.reload)
      book(name: "Ana2")
      join
      expect(response).to(have_http_status(:created))
      Forms::Definition.update(form, booking_id, { "services" => [service.merge("id" => service_id, "capacity" => 1)] })
      Forms::Publish.call(form: form.reload)
      join(name: "Cy")
      expect(response).to(have_http_status(:created))
      expect(AppointmentSlot.find_by(starts_at: Time.utc(2026, 11, 3, 9)).capacity).to(eq(2))
    end

    it "only allows a time that has people booked in full capacity, and not an empty open one" do
      join(date: "2026-11-04")
      expect(response).to(have_http_status(:conflict))
    end
  end

  describe "when a place opens" do
    before do
      book
      join(name: "Bo")
      join(name: "Cy")
    end

    it "holds the place for the first person and tells only them" do
      deliveries.clear
      perform_enqueued_jobs { cancel_booking }
      expect(entry("Bo")).to(have_attributes(status: "offered", offered_until: now + 60.minutes))
      expect(entry("Cy").status).to(eq("waiting"))
      expect(slot).to(have_attributes(booked: 0, held: 1))
      mail = deliveries.find { |item| item.to == ["bo@example.com"] }
      expect(mail.subject).to(include("place opened"))
      expect(mail.text_part.body.to_s).to(include("https://kurz.test/w/"))
      expect(deliveries.map(&:to).flatten).not_to(include("cy@example.com"))
    end

    it "keeps the held place from anyone else, even a fresh booking" do
      cancel_booking
      book(name: "Di")
      expect(response).to(have_http_status(:unprocessable_content))
      get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: "2026-11-03", to: "2026-11-03" }, headers: { "CF-Connecting-IP" => "198.51.100.77" })
      expect(json["slots"].map { |item| item["time"] }).to(eq(["10:00"]))
      expect(json["full"].map { |item| item["time"] }).to(eq(["09:00"]))
    end

    it "lists the full times for the page only when the list is on" do
      get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: "2026-11-03", to: "2026-11-03" }, headers: { "CF-Connecting-IP" => "198.51.100.78" })
      expect(json["full"].map { |item| item["time"] }).to(eq(["09:00"]))
      Forms::Definition.update(form, booking_id, { "rules" => { "waitlist" => false } })
      Forms::Publish.call(form: form.reload)
      get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: "2026-11-03", to: "2026-11-03" }, headers: { "CF-Connecting-IP" => "198.51.100.79" })
      expect(json).not_to(have_key("full"))
    end

    it "lets the person confirm and books them, once" do
      cancel_booking
      token = token_of
      post("/api/public/waitlist/#{token}/claim", as: :json)
      expect(response).to(have_http_status(:ok))
      expect(json["result"]).to(eq("claimed"))
      expect(entry("Bo").status).to(eq("claimed"))
      expect(Appointment.where(client_name: "Bo", status: "confirmed").count).to(eq(1))
      expect(slot).to(have_attributes(booked: 1, held: 0))
      expect(entry("Cy").status).to(eq("waiting"))
      post("/api/public/waitlist/#{token}/claim", as: :json)
      expect(json["result"]).to(eq("not_offered"))
      expect(Appointment.where(client_name: "Bo").count).to(eq(1))
    end

    it "offers the next person when the first lets it go" do
      cancel_booking
      post("/api/public/waitlist/#{token_of}/leave", as: :json)
      expect(json["result"]).to(eq("left"))
      expect(entry("Bo").status).to(eq("left"))
      expect(entry("Cy")).to(have_attributes(status: "offered"))
      expect(slot).to(have_attributes(booked: 0, held: 1))
    end

    it "lets someone leave while waiting without touching the place" do
      post("/api/public/waitlist/#{token_of("Cy")}/leave", as: :json)
      expect(entry("Cy").status).to(eq("left"))
      expect(slot).to(have_attributes(booked: 1, held: 0))
    end

    it "passes the place on when the time to confirm runs out" do
      cancel_booking
      expect(Appointments::Waitlist.sweep(now: now + 30.minutes)).to(eq(0))
      expect(entry("Bo").status).to(eq("offered"))
      travel_to(now + 61.minutes)
      expect(Appointments::Waitlist.sweep).to(eq(1))
      expect(entry("Bo").status).to(eq("expired"))
      expect(entry("Cy")).to(have_attributes(status: "offered", offered_until: now + 121.minutes))
      expect(slot).to(have_attributes(booked: 0, held: 1))
    end

    it "refuses a confirmation after the deadline, even before the sweep" do
      cancel_booking
      token = token_of
      travel_to(now + 2.hours)
      post("/api/public/waitlist/#{token}/claim", as: :json)
      expect(json["result"]).to(eq("expired"))
      expect(Appointment.where(client_name: "Bo")).to(be_empty)
    end

    it "frees the held place when nobody is left in line" do
      post("/api/public/waitlist/#{token_of("Cy")}/leave", as: :json)
      cancel_booking
      post("/api/public/waitlist/#{token_of("Bo")}/leave", as: :json)
      expect(slot).to(have_attributes(booked: 0, held: 0))
      book(name: "Di")
      expect(response).to(have_http_status(:created))
    end

    it "gives the place back to the public once everybody has let it go" do
      cancel_booking
      Appointments::Waitlist.sweep(now: now + 61.minutes)
      travel_to(now + 61.minutes)
      Appointments::Waitlist.sweep(now: now + 130.minutes)
      expect(WaitlistEntry.where(status: "expired").count).to(eq(2))
      expect(slot).to(have_attributes(booked: 0, held: 0))
    end

    it "drops everything once the time itself has passed" do
      travel_to(Time.utc(2026, 11, 3, 9, 30))
      Appointments::Waitlist.sweep
      expect(WaitlistEntry.active).to(be_empty)
    end

    it "counts a place freed by a decline or a timeout, like a cancellation" do
      Appointment.update_all(status: "pending", expires_at: now + 1.day)
      Forms::Definition.update(form, booking_id, { "rules" => { "approval" => "manual" } })
      Forms::Publish.call(form: form.reload)
      row = Appointment.order(:id).first
      post("/api/me/appointments/#{row.id}/decline", headers: auth_headers, as: :json)
      expect(entry("Bo").status).to(eq("offered"))
    end

    it "sends a stale or forged link nowhere: it answers like an unknown one" do
      get("/api/public/waitlist/nope")
      unknown = [response.status, response.body]
      expect(unknown.first).to(eq(404))
      [token_of.reverse, "#{token_of}x", "a" * 80].each do |guess|
        get("/api/public/waitlist/#{guess}")
        expect([response.status, response.body]).to(eq(unknown))
      end
      post("/api/public/waitlist/nope/claim", as: :json)
      expect(response).to(have_http_status(:not_found))
      post("/api/public/waitlist/nope/leave", as: :json)
      expect(response).to(have_http_status(:not_found))
    end

    it "shows the person their place without anyone else's data" do
      get("/api/public/waitlist/#{token_of}")
      expect(json["waitlist"]).to(include("service" => "Haircut", "status" => "waiting"))
      expect(response.body).not_to(include("bo@example.com", "cy@example.com", "Cy"))
    end

    it "never holds more places than there are, even when offers race" do
      WaitlistEntry.where(name: ["Bo", "Cy"]).update_all(status: "waiting")
      Appointment.update_all(status: "cancelled")
      slot.update_columns(booked: 0, held: 0)
      ids = [slot.id]
      Array.new(4) { Thread.new { ActiveRecord::Base.connection_pool.with_connection { Appointments::Waitlist.offer_for(ids) } } }.each(&:join)
      expect(WaitlistEntry.where(status: "offered").count).to(eq(1))
      expect(slot.reload).to(have_attributes(booked: 0, held: 1))
    end

    it "is gone with the form" do
      expect { form.destroy! }.to(change(WaitlistEntry, :count).by(-2))
    end
  end

  describe "the owner's view" do
    before do
      book
      join
    end

    it "lists who waits, only to the owner" do
      get("/api/me/forms/#{form.id}/waitlist", headers: auth_headers)
      expect(response).to(have_http_status(:ok))
      expect(json["waitlist"].map { |row| [row["name"], row["status"]] }).to(eq([["Bo", "waiting"]]))
      get("/api/me/forms/#{form.id}/waitlist", headers: { "Authorization" => "Bearer #{SessionToken.issue(other)}" })
      expect(response).to(have_http_status(:not_found))
      get("/api/me/forms/#{form.id}/waitlist")
      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "turning it on" do
    def update(rules)
      patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { rules: rules }, headers: auth_headers, as: :json)
    end

    it "takes the switch and a confirmation time from 15 minutes to 3 days, and refuses the rest" do
      update(waitlist: true, waitlist_confirm_minutes: 15)
      expect(response).to(have_http_status(:ok))
      [14, 4_321, 0, -1].each do |value|
        update(waitlist_confirm_minutes: value)
        expect(response).to(have_http_status(:unprocessable_content), value.inspect)
      end
      update(waitlist: "maybe")
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "blocks publishing a form with other required questions, which a confirmation could not answer" do
      Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Notes", "required" => true })
      post("/api/me/forms/#{form.id}/publish", headers: auth_headers)
      expect(response).to(have_http_status(:unprocessable_content))
      expect(response.body).to(include("waiting list"))
    end

    it "tells the public form that the list is on, and nothing else about it" do
      get("/api/public/forms/#{form.public_id}", headers: { "CF-Connecting-IP" => "198.51.100.5" })
      field = json["form"]["fields"].find { |item| item["type"] == "booking" }
      expect(field["waitlist"]).to(be(true))
      expect(response.body).not_to(include("waitlist_confirm_minutes"))
    end
  end
end
