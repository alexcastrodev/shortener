require "rails_helper"

RSpec.describe("several reminder times", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00", "11:00"] } }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }
  let(:rules) { { "reminder_minutes" => [1440, 120] } }

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

  def book(date: "2026-11-09", time: "10:00", name: "Ana")
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => [{ "date" => date, "time" => time }] } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def reminders = Notification.where(kind: "appointment_reminder").order(:id)

  def sweep(at) = travel_to(at) { Appointments::SendReminders.call }

  it "sends one reminder at each chosen time, never twice" do
    book
    expect(sweep(Time.utc(2026, 11, 8, 9, 0))).to(eq(0))
    expect(sweep(Time.utc(2026, 11, 8, 10, 5))).to(eq(1))
    expect(sweep(Time.utc(2026, 11, 8, 11, 0))).to(eq(0))
    expect(sweep(Time.utc(2026, 11, 9, 8, 5))).to(eq(1))
    expect(sweep(Time.utc(2026, 11, 9, 9, 0))).to(eq(0))
    expect(reminders.pluck(:event_key).map { |key| key.split(":").last }).to(eq(["r1440", "r120"]))
    expect(Appointment.last.reminders_sent).to(match_array([1440, 120]))
  end

  it "sends only the closest one when the sweep was late, and counts the earlier one as done" do
    book
    expect(sweep(Time.utc(2026, 11, 9, 8, 30))).to(eq(1))
    expect(reminders.count).to(eq(1))
    expect(reminders.last.event_key).to(end_with(":r120"))
    expect(sweep(Time.utc(2026, 11, 9, 9, 0))).to(eq(0))
  end

  it "skips a time that was already past when the booking was made" do
    travel_to(Time.utc(2026, 11, 9, 5, 0))
    allow(Forms::Publish).to(receive(:call).and_call_original)
    book(date: "2026-11-09", time: "09:00")
    travel_to(now)
    expect(sweep(Time.utc(2026, 11, 9, 6, 0))).to(eq(0))
    expect(sweep(Time.utc(2026, 11, 9, 7, 5))).to(eq(1))
    expect(reminders.count).to(eq(1))
  end

  it "keeps the 24 hour reminder when the form chose nothing" do
    Forms::Definition.update(form, booking_id, { "rules" => { "reminder_minutes" => nil } })
    Forms::Publish.call(form: form.reload)
    book
    expect(sweep(Time.utc(2026, 11, 8, 10, 5))).to(eq(1))
    expect(sweep(Time.utc(2026, 11, 9, 8, 5))).to(eq(0))
  end

  it "sends none when the list is empty" do
    Forms::Definition.update(form, booking_id, { "rules" => { "reminder_minutes" => [] } })
    Forms::Publish.call(form: form.reload)
    book
    expect(sweep(Time.utc(2026, 11, 8, 10, 5))).to(eq(0))
    expect(sweep(Time.utc(2026, 11, 9, 8, 5))).to(eq(0))
  end

  it "does not remind a booking that was cancelled or has no email" do
    book
    Appointment.update_all(status: "cancelled")
    expect(sweep(Time.utc(2026, 11, 8, 10, 5))).to(eq(0))
    Appointment.update_all(status: "confirmed", client_email: nil)
    expect(sweep(Time.utc(2026, 11, 8, 10, 5))).to(eq(0))
  end

  describe "setting it" do
    def update(value)
      patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { rules: { reminder_minutes: value } }, headers: auth_headers, as: :json)
    end

    it "accepts up to three different times from 15 minutes to 7 days, and none" do
      [[15], [1440, 120, 10_080], []].each do |value|
        update(value)
        expect(response).to(have_http_status(:ok), value.inspect)
      end
    end

    it "refuses too many, repeated, out of range and non-numbers" do
      [[1440, 120, 60, 30], [120, 120], [14], [10_081], [-1], ["soon"]].each do |value|
        update(value)
        expect(response).to(have_http_status(:unprocessable_content), value.inspect)
      end
    end
  end
end
