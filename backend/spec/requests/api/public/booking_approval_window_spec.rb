require "rails_helper"

RSpec.describe("approval only for last-minute bookings", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 2, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
  let(:rules) { { "approval" => "manual", "approval_within_minutes" => 2_880 } }

  around do |example|
    previous = ENV["GMAIL_USERNAME"]
    ENV["GMAIL_USERNAME"] = "kurz.fyi@gmail.com"
    example.run
  ensure
    ENV["GMAIL_USERNAME"] = previous
  end

  before do
    host! "localhost"
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => rules })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def book(list, name: "Ana")
    sessions = list.map { |date, time| { "date" => date, "time" => time } }
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => sessions } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def statuses = Appointment.order(:id).pluck(:status)

  it "asks for approval when the first session is within the window" do
    book([["2026-11-03", "09:00"]])
    expect(response).to(have_http_status(:created))
    expect(statuses).to(eq(["pending"]))
    expect(Appointment.last.expires_at).to(be_present)
  end

  it "confirms at once, with no deadline, when the first session is further away" do
    book([["2026-11-09", "09:00"]])
    expect(response).to(have_http_status(:created))
    expect(statuses).to(eq(["confirmed"]))
    expect(Appointment.last.expires_at).to(be_nil)
    expect(Notification.where(kind: "appointment_created").count).to(be >= 1)
    expect(Notification.where(kind: "appointment_requested")).to(be_empty)
  end

  it "judges the whole booking by its earliest session" do
    book([["2026-11-03", "09:00"], ["2026-11-10", "09:00"]])
    expect(statuses).to(eq(["pending", "pending"]))
  end

  it "counts the window from the moment of booking, to the minute" do
    Forms::Definition.update(form, booking_id, { "rules" => { "approval_within_minutes" => 3_000 } })
    Forms::Publish.call(form: form.reload)
    book([["2026-11-04", "10:00"]])
    expect(statuses).to(eq(["confirmed"]))
    book([["2026-11-04", "09:00"]])
    expect(statuses.last).to(eq("pending"))
  end

  it "keeps every booking under approval when no window is set" do
    Forms::Definition.update(form, booking_id, { "rules" => { "approval_within_minutes" => nil } })
    Forms::Publish.call(form: form.reload)
    book([["2026-11-16", "09:00"]])
    expect(statuses).to(eq(["pending"]))
  end

  it "does nothing in automatic mode" do
    Forms::Definition.update(form, booking_id, { "rules" => { "approval" => "auto" } })
    Forms::Publish.call(form: form.reload)
    book([["2026-11-03", "09:00"]])
    expect(statuses).to(eq(["confirmed"]))
  end

  it "does not tell the client to wait when the booking is confirmed on the spot" do
    perform_enqueued_jobs { book([["2026-11-09", "09:00"]]) }
    kinds = Notification.where(recipient_kind: "client").pluck(:kind)
    expect(kinds).to(eq(["appointment_confirmed"]))
  end

  describe "setting it" do
    def update(rules)
      patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { rules: rules }, headers: auth_headers, as: :json)
    end

    it "accepts 1 to 43,200 minutes and clearing it" do
      update(approval_within_minutes: 60)
      expect(response).to(have_http_status(:ok))
      expect(form.reload.fields.find { |field| field["type"] == "booking" }["rules"]["approval_within_minutes"]).to(eq(60))
      update(approval_within_minutes: nil)
      expect(response).to(have_http_status(:ok))
    end

    it "refuses zero, a negative, too many minutes and a word" do
      [0, -5, 43_201, "soon"].each do |value|
        update(approval_within_minutes: value)
        expect(response).to(have_http_status(:unprocessable_content), value.inspect)
      end
    end
  end
end
