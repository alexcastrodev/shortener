require "rails_helper"

RSpec.describe("security checks for appointments: races, ownership, links, abuse, order", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:other) { FactoryBot.create(:user) }
  let(:other_headers) { { "Authorization" => "Bearer #{SessionToken.issue(other)}" } }
  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:rules) { { "approval" => "manual", "approval_timeout_minutes" => 1440 } }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
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
    allow(ENV).to(receive(:[]).with("FRONTEND_URL").and_return("https://kurz.test"))
    allow(ENV).to(receive(:fetch).and_call_original)
    allow(ENV).to(receive(:fetch).with("FRONTEND_URL", anything).and_return("https://kurz.test"))
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => rules })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def book(name: "Ana", date: "2026-11-03", time: "09:00", ip: "198.51.100.#{rand(1..250)}", headers: {})
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => [{ "date" => date, "time" => time }] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => ip }.merge(headers), as: :json)
  end

  def first_row = Appointment.order(:id).first

  def act(verb, row_id, headers: auth_headers, params: {})
    post("/api/me/appointments/#{row_id}/#{verb}", params: params, headers: headers, as: :json)
  end

  describe "V01: one place is never sold twice" do
    it "lets exactly one of many bookings for a single place through and counts it once" do
      statuses = Array.new(8) { |index| book(name: "Client#{index}", ip: "198.51.100.#{index + 1}") && response.status }
      expect(statuses.tally).to(eq(201 => 1, 422 => 7))
      expect(AppointmentSlot.sum(:booked)).to(eq(1))
      expect(Appointment.count).to(eq(1))
      expect(FormResponse.count).to(eq(1))
    end

    it "keeps a pending request holding its place, and frees it only when declined" do
      book
      book(name: "Bo")
      expect(response).to(have_http_status(:unprocessable_content))
      act("decline", first_row.id)
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
      book(name: "Bo")
      expect(response).to(have_http_status(:created))
      expect(AppointmentSlot.sum(:booked)).to(eq(1))
    end

    it "does not oversell when many threads book the same place at once" do
      results = Array.new(6) do
        Thread.new do
          ActiveRecord::Base.connection_pool.with_connection do
            Appointments::Reserve.call(form: form, service_key: service_id, capacity: 1, times: [Time.utc(2026, 11, 3, 9)])
            :booked
          rescue Appointments::Reserve::Full
            :full
          end
        end
      end.map(&:value)
      expect(results.tally).to(eq(booked: 1, full: 5))
      expect(AppointmentSlot.sum(:booked)).to(eq(1))
    end
  end

  describe "V02: another owner can neither see nor change an appointment" do
    before { book }

    it "answers an owner action on someone else's appointment exactly like one that does not exist" do
      ["approve", "decline", "cancel", "reschedule", "remind"].each do |verb|
        act(verb, 987_654_321, headers: other_headers, params: { date: "2026-11-04", time: "09:00" })
        missing = [response.status, response.body]
        act(verb, first_row.id, headers: other_headers, params: { date: "2026-11-04", time: "09:00" })
        expect([response.status, response.body]).to(eq(missing), verb)
        expect(missing.first).to(eq(404))
      end
      expect(first_row.reload.status).to(eq("pending"))
    end

    it "answers the list, the export and the agenda of someone else's form without a trace of it" do
      get("/api/me/forms/#{form.id}/appointments", headers: other_headers)
      expect(response).to(have_http_status(:not_found))
      get("/api/me/forms/#{form.id}/appointments_export", headers: other_headers)
      expect(response).to(have_http_status(:not_found))
      get("/api/me/agenda", params: { from: "2026-11-01", to: "2026-11-30" }, headers: other_headers)
      expect(response.body).not_to(include("Ana", "ana@example.com", form.title))
    end

    it "refuses every owner route without a token" do
      ["approve", "decline", "cancel", "reschedule", "remind"].each do |verb|
        post("/api/me/appointments/#{first_row.id}/#{verb}", as: :json)
        expect(response).to(have_http_status(:unauthorized), verb)
      end
      get("/api/me/forms/#{form.id}/appointments")
      expect(response).to(have_http_status(:unauthorized))
    end
  end

  describe "V03: the links that act on a booking" do
    before { book }

    let(:raw) { AppointmentToken.issue(booking: first_row, expires_at: now + 30.days) }

    it "is long, random, different every time and stored only as a digest" do
      second = AppointmentToken.issue(booking: first_row, expires_at: now + 30.days)
      expect(raw.length).to(be >= 43)
      expect(raw).to(match(/\A[A-Za-z0-9_-]+\z/))
      expect(second).not_to(eq(raw))
      stored = AppointmentToken.pluck(:digest)
      expect(stored).not_to(include(raw, second))
      expect(stored).to(all(match(/\A\h{64}\z/)))
    end

    it "answers a guessed, a truncated and an altered link like an unknown one" do
      get("/api/public/appointments/nope")
      unknown = [response.status, response.body]
      [raw.first(20), raw.reverse, "#{raw}x", raw.upcase, raw.tr("A-Za-z", "B-ZAb-za")].each do |guess|
        get("/api/public/appointments/#{guess}")
        expect([response.status, response.body]).to(eq(unknown), guess)
      end
    end

    it "stops working once it expires" do
      get("/api/public/appointments/#{raw}")
      expect(response).to(have_http_status(:ok))
      travel_to(now + 31.days)
      get("/api/public/appointments/#{raw}")
      expect(response).to(have_http_status(:not_found))
    end

    it "serves the receipt link only for the booking it was made for" do
      book(name: "Bo", time: "10:00")
      mine = AppointmentToken.issue(booking: Appointment.order(:id).last, expires_at: now + 30.days)
      get("/api/public/appointments/#{mine}")
      expect(response.body).to(include("2026-11-03T10:00:00Z"))
      expect(response.body).not_to(include("2026-11-03T09:00:00Z"))
    end
  end

  describe "V08: the public routes have a ceiling" do
    it "limits the booking page per address, and only that address" do
      60.times { get("/api/public/appointments/nope", headers: { "CF-Connecting-IP" => "203.0.113.50" }) }
      get("/api/public/appointments/nope", headers: { "CF-Connecting-IP" => "203.0.113.50" })
      expect(response).to(have_http_status(:too_many_requests))
      get("/api/public/appointments/nope", headers: { "CF-Connecting-IP" => "203.0.113.51" })
      expect(response).to(have_http_status(:not_found))
    end

    it "limits cancellations per address" do
      20.times { post("/api/public/appointments/nope/cancel", headers: { "CF-Connecting-IP" => "203.0.113.60" }, as: :json) }
      post("/api/public/appointments/nope/cancel", headers: { "CF-Connecting-IP" => "203.0.113.60" }, as: :json)
      expect(response).to(have_http_status(:too_many_requests))
    end

    it "limits the free-times lookups per address" do
      120.times { get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: "2026-11-03", to: "2026-11-03" }, headers: { "CF-Connecting-IP" => "203.0.113.70" }) }
      get("/api/public/forms/#{form.public_id}/slots", params: { service: service_id, from: "2026-11-03", to: "2026-11-03" }, headers: { "CF-Connecting-IP" => "203.0.113.70" })
      expect(response).to(have_http_status(:too_many_requests))
    end

    it "limits bookings per address" do
      30.times { |index| book(name: "C#{index}", date: "2026-11-#{format("%02d", 3 + (index / 2) % 20)}", time: index.even? ? "09:00" : "10:00", ip: "203.0.113.80") }
      book(name: "Late", ip: "203.0.113.80")
      expect(response).to(have_http_status(:too_many_requests))
    end

    it "refuses a booking without passing the human check" do
      allow(Turnstile).to(receive(:check).and_return(:rejected))
      book
      expect(response).not_to(have_http_status(:created))
      expect(Appointment.count).to(eq(0))
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
    end
  end

  describe "V09: links in emails go only to the app" do
    it "never takes a host from the request" do
      perform_enqueued_jobs { book(headers: { "X-Forwarded-Host" => "evil.example", "Origin" => "https://evil.example", "Referer" => "https://evil.example/x" }) }
      expect(response).to(have_http_status(:created))
      expect(deliveries).not_to(be_empty)
      bodies = deliveries.flat_map { |mail| [mail.html_part&.body.to_s, mail.text_part&.body.to_s, mail.body.to_s] }.join("\n")
      hosts = bodies.scan(%r{https?://([^/\s"'<>)]+)}).flatten.uniq
      expect(hosts).to(include("kurz.test"))
      expect(hosts).not_to(include("evil.example"))
      expect(hosts - ["kurz.test", "kurz.fyi", "localhost", "www.w3.org"]).to(be_empty)
    end

    it "returns a manage link on the app's host" do
      book(headers: { "X-Forwarded-Host" => "evil.example" })
      expect(json["manage_url"]).to(start_with("https://kurz.test/m/"))
    end
  end

  describe "V14: a booking only moves along allowed paths" do
    before { book }

    it "decides once: a second approval, a decline after an approval and an approval after a decline all say it was decided" do
      act("approve", first_row.id)
      expect(response).to(have_http_status(:ok))
      act("approve", first_row.id)
      expect(response).to(have_http_status(:conflict))
      act("decline", first_row.id)
      expect(response).to(have_http_status(:conflict))
      expect(first_row.reload.status).to(eq("confirmed"))
      expect(AppointmentSlot.sum(:booked)).to(eq(1))
    end

    it "does not approve a request that was declined or cancelled, and does not free its place twice" do
      act("decline", first_row.id)
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
      act("approve", first_row.id)
      expect(response).to(have_http_status(:conflict))
      act("decline", first_row.id)
      expect(response).to(have_http_status(:conflict))
      expect(first_row.reload.status).to(eq("declined"))
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
    end

    it "does not approve after the deadline" do
      travel_to(now + 2.days)
      act("approve", first_row.id)
      expect(response).to(have_http_status(:conflict))
      expect(first_row.reload.status).to(eq("pending"))
    end

    it "does not reschedule, remind or cancel again what is already cancelled" do
      act("approve", first_row.id)
      act("cancel", first_row.id)
      expect(response).to(have_http_status(:ok))
      expect(first_row.reload.status).to(eq("cancelled"))
      act("cancel", first_row.id)
      expect(response).to(have_http_status(:unprocessable_content))
      act("reschedule", first_row.id, params: { date: "2026-11-04", time: "10:00" })
      expect(response).to(have_http_status(:unprocessable_content))
      act("remind", first_row.id)
      expect(response).to(have_http_status(:unprocessable_content))
      act("approve", first_row.id)
      expect(response).to(have_http_status(:conflict))
      expect(first_row.reload.status).to(eq("cancelled"))
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
    end

    it "treats an unknown decision as invalid and changes nothing" do
      expect(Appointments::Decide.call(appointment: first_row, decision: "delete")).to(eq(:invalid))
      expect(first_row.reload.status).to(eq("pending"))
    end
  end
end
