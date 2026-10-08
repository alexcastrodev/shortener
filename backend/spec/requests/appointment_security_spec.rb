require "rails_helper"

RSpec.describe("security checks for appointments", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "price" => 25, "currency" => "EUR", "capacity" => nil, "days" => ["tue", "wed"], "times" => ["09:00", "10:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
  let(:deliveries) { ActionMailer::Base.deliveries }
  let(:session) { { "date" => "2026-11-03", "time" => "09:00" } }

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
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => { "approval" => "auto" } })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def submit(answers: {}, extra: {}, ip: "198.51.100.#{rand(1..250)}")
    base = { name_id => "Ana", mail_id => "ana@example.com", booking_id => { "service" => service_id, "sessions" => [session] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: base.merge(answers), turnstile_token: "t" }.merge(extra), headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  describe "V04 and V06: what a client types never becomes markup or a header" do
    let(:script) { "<script>alert(1)</script><img src=x onerror=alert(2)>" }

    it "escapes the name in every HTML email" do
      perform_enqueued_jobs { submit(answers: { name_id => script }) }
      expect(response).to(have_http_status(:created))
      html = deliveries.map { |mail| mail.html_part&.body.to_s }.join
      expect(html).not_to(include("<script>", "<img src=x"))
      expect(html).to(include("&lt;script&gt;"))
    end

    it "keeps a name with line breaks out of subjects and headers" do
      perform_enqueued_jobs { submit(answers: { name_id => "Ana\r\nBcc: evil@example.com\r\nSubject: hacked" }) }
      expect(response).to(have_http_status(:created))
      expect(deliveries).not_to(be_empty)
      deliveries.each do |mail|
        expect(mail.subject).not_to(match(/[\r\n]/))
        expect(mail.bcc).to(be_blank)
        expect(mail.header.fields.map(&:name)).not_to(include("Bcc"))
      end
    end

    it "serves the stored name as data, never as markup, to the owner's JSON endpoints" do
      submit(answers: { name_id => script })
      get("/api/me/forms/#{form.id}/appointments", headers: auth_headers)
      expect(response.media_type).to(eq("application/json"))
      expect(response.headers["X-Content-Type-Options"]).to(eq("nosniff"))
    end
  end

  describe "V11: the client cannot choose what the server decides" do
    it "ignores a status, price, form or slot sent at any level" do
      submit(
        answers: { booking_id => { "service" => service_id, "sessions" => [session], "status" => "declined", "price" => 0, "total" => 0, "form_id" => 999, "slot_id" => 1 } },
        extra: { status: "declined", price: 0, form_id: 999, slot_id: 1, appointment: { status: "declined" } },
      )
      expect(response).to(have_http_status(:created))
      row = Appointment.last
      expect(row).to(have_attributes(status: "confirmed", form_id: form.id))
      expect(row.snapshot).to(include("total" => 25.0, "price" => 25))
      expect(FormResponse.last.answers[booking_id].keys).to(match_array(["service", "sessions"]))
    end

    it "refuses a session that carries anything beyond a date and a time by ignoring the rest" do
      submit(answers: { booking_id => { "service" => service_id, "sessions" => [session.merge("starts_at" => "2020-01-01T00:00:00Z", "slot_id" => 5)] } })
      expect(response).to(have_http_status(:created))
      expect(Appointment.last.slot.starts_at).to(eq(Time.utc(2026, 11, 3, 9)))
    end

    it "does not let the client pick the contact fields of another appointment" do
      submit(answers: { "client_email" => "evil@example.com", "client_name" => "Evil" }, extra: { confirm_field_id: mail_id })
      expect(Appointment.last).to(have_attributes(client_name: "Ana", client_email: "ana@example.com"))
    end
  end

  describe "V12: pathological input is refused quickly" do
    def quickly
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      yield
      expect(Process.clock_gettime(Process::CLOCK_MONOTONIC) - started).to(be < 2.0)
    end

    it "refuses thousands of sessions" do
      quickly { submit(answers: { booking_id => { "service" => service_id, "sessions" => Array.new(5_000) { |index| { "date" => (Date.new(2026, 11, 3) + index).iso8601, "time" => "09:00" } } } }) }
      expect([413, 422]).to(include(response.status))
      expect(Appointment.count).to(eq(0))
    end

    it "refuses a very long or oddly shaped email without burning CPU" do
      ["a" * 20_000 + "@example.com", "#{"a." * 5_000}@example.com", "a@" + "b." * 5_000 + "c"].each do |email|
        quickly { submit(answers: { mail_id => email }) }
        expect(response).to(have_http_status(:unprocessable_content))
      end
    end

    it "refuses answers nested far too deep and a booking that is not an object, with an error and not a crash" do
      deep = (1..200).inject("x") { |inner, _| { "a" => inner } }
      quickly { submit(answers: { booking_id => deep }) }
      expect(response.status).to(be_between(400, 499))
      submit(answers: { booking_id => [1, [2, [3]]] })
      expect(response.status).to(be_between(400, 499))
      submit(answers: { booking_id => 12_345 })
      expect(response.status).to(be_between(400, 499))
    end

    it "refuses a body that is far too large" do
      quickly { post("/api/public/forms/#{form.public_id}/responses", params: { answers: { name_id => "x" * 500_000 }, turnstile_token: "t" }.to_json, headers: { "Content-Type" => "application/json", "CF-Connecting-IP" => "198.51.100.9" }) }
      expect(response.status).to(be_between(400, 499))
      expect(Appointment.count).to(eq(0))
    end

    it "refuses a name longer than the limit" do
      submit(answers: { name_id => "n" * 501 })
      expect(response).to(have_http_status(:unprocessable_content))
    end
  end

  describe "V13: the client's name and email do not reach the logs" do
    it "writes neither the name nor the email of a booking to the log" do
      io = StringIO.new
      logger = ActiveSupport::Logger.new(io)
      logger.level = Logger::INFO
      Rails.logger.broadcast_to(logger)
      begin
        submit(answers: { name_id => "Zed Marker\nFAKE LOG LINE", mail_id => "marker.person@example.com" })
      ensure
        Rails.logger.stop_broadcasting_to(logger)
      end
      expect(response).to(have_http_status(:created))
      expect(io.string).to(include("POST \"/api/public/forms/"))
      expect(io.string).not_to(include("Zed Marker", "FAKE LOG LINE", "marker.person@example.com"))
    end
  end

  describe "V10: a stranger learns nothing from the answers" do
    it "answers the same to an unknown manage link, a malformed one and an expired one" do
      submit
      expired = AppointmentToken.issue(booking: Appointment.last, expires_at: now - 1.minute)
      bodies = ["nope", "x" * 5_000, expired.to_s].map do |token|
        get("/api/public/appointments/#{token}")
        expect(response).to(have_http_status(:not_found))
        response.body
      end
      expect(bodies.uniq.size).to(eq(1))
    end

    it "answers the same to a slots request for an unknown, unpublished and malformed form" do
      Forms::Unpublish.call(form: form.reload)
      bodies = [form.public_id, "nope", "AAAAAAAAAAAA"].map do |id|
        get("/api/public/forms/#{id}/slots", params: { service: service_id, from: "2026-11-03", to: "2026-11-04" }, headers: { "CF-Connecting-IP" => "198.51.100.5" })
        expect(response).to(have_http_status(:not_found))
        response.body
      end
      expect(bodies.uniq.size).to(eq(1))
      get("/api/public/forms/../etc/passwd/slots", params: { service: service_id, from: "2026-11-03", to: "2026-11-04" })
      expect(response).to(have_http_status(:not_found))
    end
  end
end
