require "rails_helper"

RSpec.describe("the owner approves, declines and cancels from the agenda", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:other) { FactoryBot.create(:user) }
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
    allow(Turnstile).to(receive(:check).and_return(:ok))
    allow(ENV).to(receive(:[]).and_call_original)
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => rules })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
    book([["2026-11-03", "09:00"], ["2026-11-04", "10:00"]])
    deliveries.clear
  end

  def json = JSON.parse(response.body)

  def book(list, name: "Ana", ip: "198.51.100.7")
    sessions = list.map { |date, time| { "date" => date, "time" => time } }
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => sessions } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_locale: "en" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  def first_row = Appointment.order(:id).first

  def act(verb, row = first_row, params = {}, headers: auth_headers)
    post("/api/me/appointments/#{row.id}/#{verb}", params: params, headers: headers, as: :json)
  end

  def other_headers = { "Authorization" => "Bearer #{SessionToken.issue(other)}" }

  describe "access" do
    it "answers 401 without a token, 404 for another owner's appointment and 404 with the feature off" do
      ["approve", "decline", "cancel"].each do |verb|
        post("/api/me/appointments/#{first_row.id}/#{verb}", as: :json)
        expect(response).to(have_http_status(:unauthorized), verb)
        act(verb, first_row, {}, headers: other_headers)
        expect(response).to(have_http_status(:not_found), verb)
      end
    end
  end

  describe "approving" do
    it "confirms every session of the booking, keeps the places and tells the client with the message" do
      perform_enqueued_jobs { act("approve", first_row, { message: "See you soon" }) }
      expect(response).to(have_http_status(:ok))
      expect(json["appointments"].map { |row| row["status"] }).to(eq(["confirmed", "confirmed"]))
      expect(Appointment.first).to(have_attributes(decided_by: "owner", decision_message: "See you soon", decided_at: now))
      expect(AppointmentSlot.sum(:booked)).to(eq(2))
      expect(deliveries.map(&:to)).to(eq([["ana@example.com"]]))
      expect(deliveries.last.subject).to(start_with("Confirmed: Haircut"))
    end

    it "decides once: a second approval or a later decline changes nothing and sends nothing" do
      act("approve")
      deliveries.clear
      perform_enqueued_jobs do
        act("approve")
        expect(response).to(have_http_status(:conflict))
        expect(json["error"]).to(eq("already_decided"))
        act("decline")
        expect(response).to(have_http_status(:conflict))
      end
      expect(Appointment.pluck(:status).uniq).to(eq(["confirmed"]))
      expect(deliveries).to(be_empty)
    end

    it "refuses once the deadline has passed" do
      travel_to(now + 25.hours) { act("approve", first_row, {}, headers: { "Authorization" => "Bearer #{SessionToken.issue(current_user)}" }) }
      expect(response).to(have_http_status(:conflict))
      expect(json["error"]).to(eq("expired"))
      expect(Appointment.pluck(:status).uniq).to(eq(["pending"]))
    end
  end

  describe "declining" do
    it "frees the places, tells the client with the message and lets someone else book" do
      perform_enqueued_jobs { act("decline", first_row, { message: "Closed that day" }) }
      expect(response).to(have_http_status(:ok))
      expect(json["appointments"].map { |row| row["status"] }.uniq).to(eq(["declined"]))
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
      expect(deliveries.last.subject).to(start_with("Not confirmed: Haircut"))
      expect(deliveries.last.text_part.body.to_s).to(include("Closed that day"))
      book([["2026-11-03", "09:00"]], name: "Bo", ip: "198.51.100.8")
      expect(response).to(have_http_status(:created))
    end
  end

  describe "cancelling" do
    before { Appointment.update_all(status: "confirmed") }

    it "cancels every upcoming session of the booking, frees the places and tells only the client" do
      before_bell = Notification.where(channel: "in_app").count
      perform_enqueued_jobs { act("cancel", first_row, { reason: "I am ill" }) }
      expect(response).to(have_http_status(:ok))
      expect(json["appointments"].map { |row| row["status"] }.uniq).to(eq(["cancelled"]))
      expect(Appointment.pluck(:cancelled_by, :cancel_reason).uniq).to(eq([["owner", "I am ill"]]))
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
      expect(deliveries.map(&:to)).to(eq([["ana@example.com"]]))
      expect(deliveries.last.subject).to(start_with("Cancelled: Haircut"))
      expect(Notification.where(channel: "in_app").count).to(eq(before_bell))
    end

    it "cancels a request that is still waiting" do
      Appointment.update_all(status: "pending")
      act("cancel")
      expect(response).to(have_http_status(:ok))
      expect(Appointment.pluck(:status).uniq).to(eq(["cancelled"]))
    end

    it "leaves sessions that already started and answers nothing_to_cancel when none is left" do
      travel_to(Time.utc(2026, 11, 3, 12)) { act("cancel", first_row, {}, headers: { "Authorization" => "Bearer #{SessionToken.issue(current_user)}" }) }
      expect(response).to(have_http_status(:ok))
      expect(Appointment.order(:id).pluck(:status)).to(eq(["confirmed", "cancelled"]))

      travel_to(Time.utc(2026, 11, 5)) { act("cancel", first_row, {}, headers: { "Authorization" => "Bearer #{SessionToken.issue(current_user)}" }) }
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["error"]).to(eq("nothing_to_cancel"))
    end

    it "does it once and shows in the agenda" do
      act("cancel")
      act("cancel")
      expect(response).to(have_http_status(:unprocessable_content))
      get("/api/me/agenda", params: { from: "2026-11-03", to: "2026-11-04" }, headers: auth_headers)
      expect(JSON.parse(response.body)["sessions"].map { |session| session["booked"] }.uniq).to(eq([0]))
    end
  end

  it "keeps the client's own cancellation telling the owner, as before" do
    Appointment.update_all(status: "confirmed")
    token = AppointmentToken.issue(booking: first_row, expires_at: now + 30.days)
    post("/api/public/appointments/#{token}/cancel", as: :json)
    expect(Notification.where(channel: "in_app", kind: "appointment_cancelled", user_id: current_user.id).count).to(eq(1))
    expect(Appointment.pluck(:cancelled_by).uniq).to(eq(["client"]))
  end
end
