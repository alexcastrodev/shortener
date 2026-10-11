require "rails_helper"

RSpec.describe("fixed monthly booking", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Pilates", "duration" => 60, "price" => 20, "currency" => "EUR", "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00"], "monthly" => { "price" => 120 } } }
  let(:form) { Form.create!(user: current_user, title: "Studio") }
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
    travel_to(now)
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => { "approval" => "auto", "window_days" => 90 }, "exceptions" => [{ "from" => "2026-11-11", "kind" => "closed" }] })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def monthly(month: "2026-11", weekdays: ["mon", "wed"], time: "09:00", name: "Ana", service: service_id)
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service, "monthly" => { "month" => month, "weekdays" => weekdays, "time" => time } } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_time_zone: "UTC" }, headers: { "CF-Connecting-IP" => "198.51.100.#{rand(1..250)}" }, as: :json)
  end

  def days = Appointment.joins(:slot).order("appointment_slots.starts_at").pluck("appointment_slots.starts_at").map { |time| time.strftime("%m-%d") }

  describe "booking" do
    it "books every matching day of the month from today, all together, skipping a day off and saying so" do
      monthly
      expect(response).to(have_http_status(:created))
      expect(days).to(eq(["11-02", "11-04", "11-09", "11-16", "11-18", "11-23", "11-25", "11-30"]))
      expect(Appointment.pluck(:group_key).uniq.size).to(eq(1))
      expect(json["skipped"]).to(eq(["2026-11-11"]))
      expect(json["price"]).to(include("total" => 120.0, "currency" => "EUR"))
      expect(AppointmentSlot.sum(:booked)).to(eq(8))
    end

    it "can book next month, and counts the monthly price once whatever the number of sessions" do
      monthly(month: "2026-12", weekdays: ["tue"])
      expect(response).to(have_http_status(:created))
      expect(days).to(eq(["12-01", "12-08", "12-15", "12-22", "12-29"]))
      expect(json["price"]["total"]).to(eq(120.0))
    end

    it "is all or nothing: one full day stops the whole booking and nothing is held" do
      monthly(name: "Bo", weekdays: ["wed"])
      expect(Appointment.count).to(eq(3))
      monthly(name: "Ana")
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json.dig("errors", "answers", booking_id)).to(eq(["unavailable"]))
      expect(Appointment.count).to(eq(3))
      expect(AppointmentSlot.sum(:booked)).to(eq(3))
    end

    it "refuses a past month, a month too far ahead and a malformed one" do
      ["2026-10", "2027-01", "2026-13", "nov", ""].each do |month|
        monthly(month: month)
        expect(response).to(have_http_status(:unprocessable_content), month)
      end
      expect(Appointment.count).to(eq(0))
    end

    it "refuses bad days, repeated days and a time the service does not offer" do
      [[], ["mon", "mon"], ["monday"], "mon"].each do |weekdays|
        monthly(weekdays: weekdays)
        expect(response).to(have_http_status(:unprocessable_content), weekdays.inspect)
      end
      monthly(time: "13:00")
      expect(response).to(have_http_status(:unprocessable_content))
      monthly(time: "9am")
      expect(response).to(have_http_status(:unprocessable_content))
      expect(Appointment.count).to(eq(0))
    end

    it "refuses it for a service that does not offer it" do
      Forms::Definition.update(form, booking_id, { "services" => [service.merge("id" => service_id, "monthly" => nil)] })
      Forms::Publish.call(form: form.reload)
      monthly
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "refuses it when every chosen day is off" do
      monthly(weekdays: ["sat", "sun"])
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "keeps one confirmation email with every session" do
      perform_enqueued_jobs { monthly }
      mail = deliveries.find { |item| item.to == ["ana@example.com"] }
      expect(mail.text_part.body.to_s.scan(/^- /).size).to(eq(8))
    end
  end

  describe "a plan with an allowance" do
    let(:allowance) { { "sessions" => 3 } }
    let(:service) { super().merge("monthly" => { "price" => 120 }.merge(allowance)) }

    def plan(*picks, month: "2026-11", name: "Ana", service: service_id, ip: "198.51.100.#{rand(1..250)}")
      sessions = picks.map { |date, time| { "date" => date, "time" => time } }
      answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service, "monthly" => { "month" => month, "sessions" => sessions } } }
      post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_time_zone: "UTC" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
    end

    it "books the days the visitor chose, each with its own time, for the price of the plan" do
      plan(["2026-11-03", "09:00"], ["2026-11-05", "10:00"], ["2026-11-17", "09:00"])

      expect(response).to(have_http_status(:created))
      expect(days).to(eq(["11-03", "11-05", "11-17"]))
      expect(Appointment.joins(:slot).order("appointment_slots.starts_at").map { |row| row.slot.starts_at.strftime("%H:%M") }).to(eq(["09:00", "10:00", "09:00"]))
      expect(Appointment.pluck(:group_key).uniq.size).to(eq(1))
      expect(json["price"]).to(include("total" => 120.0, "currency" => "EUR"))
      expect(json["skipped"]).to(eq([]))
      expect(Appointment.first.snapshot["monthly"]).to(eq("month" => "2026-11", "skipped" => []))
      expect(FormResponse.last.answers[booking_id]["sessions"].size).to(eq(3))
    end

    it "charges the whole plan even when fewer sessions are chosen" do
      plan(["2026-11-03", "09:00"])

      expect(response).to(have_http_status(:created))
      expect(Appointment.count).to(eq(1))
      expect(json["price"]["total"]).to(eq(120.0))
    end

    it "refuses more sessions than the plan includes and books nothing" do
      plan(["2026-11-03", "09:00"], ["2026-11-04", "09:00"], ["2026-11-05", "09:00"], ["2026-11-06", "09:00"])

      expect(response).to(have_http_status(:unprocessable_content))
      expect(json.dig("errors", "answers", booking_id)).to(eq(["invalid"]))
      expect(Appointment.count).to(eq(0))
      expect(AppointmentSlot.count).to(eq(0))
    end

    it "refuses the weekday pattern, a month that is not this or the next, a day of another month and a day in the past" do
      monthly
      expect(response).to(have_http_status(:unprocessable_content))
      plan(["2026-11-03", "09:00"], month: "2027-01")
      expect(response).to(have_http_status(:unprocessable_content))
      plan(["2026-12-01", "09:00"], month: "2026-11")
      expect(response).to(have_http_status(:unprocessable_content))
      plan(["2026-11-01", "09:00"])
      expect(response).to(have_http_status(:unprocessable_content))
      expect(Appointment.count).to(eq(0))
    end

    it "refuses repeated picks, an empty list and a malformed pick" do
      plan(["2026-11-03", "09:00"], ["2026-11-03", "09:00"])
      expect(response).to(have_http_status(:unprocessable_content))
      plan
      expect(response).to(have_http_status(:unprocessable_content))
      plan(["soon", "09:00"])
      expect(response).to(have_http_status(:unprocessable_content))
      plan(["2026-11-03", "9am"])
      expect(response).to(have_http_status(:unprocessable_content))
      expect(Appointment.count).to(eq(0))
    end

    it "is all or nothing: a taken time or a day off refuses the whole plan" do
      plan(["2026-11-03", "09:00"], name: "Bo")
      expect(Appointment.count).to(eq(1))

      plan(["2026-11-03", "09:00"], ["2026-11-05", "10:00"])
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json.dig("errors", "answers", booking_id)).to(eq(["unavailable"]))

      plan(["2026-11-05", "10:00"], ["2026-11-11", "09:00"])
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json.dig("errors", "answers", booking_id)).to(eq(["unavailable"]))
      expect(Appointment.count).to(eq(1))
    end

    it "lets a time that is not offered be refused, not booked" do
      plan(["2026-11-03", "13:00"])
      expect(response).to(have_http_status(:unprocessable_content))
      plan(["2026-11-08", "09:00"])
      expect(response).to(have_http_status(:unprocessable_content))
      expect(Appointment.count).to(eq(0))
    end

    it "can be cancelled from the day it is, like any series" do
      plan(["2026-11-03", "09:00"], ["2026-11-05", "10:00"], ["2026-11-17", "09:00"])
      token = json["manage_url"].split("/").last
      second = Appointment.joins(:slot).order("appointment_slots.starts_at").second

      get("/api/public/appointments/#{token}")
      expect(json["appointment"]).to(include("series" => true))
      post("/api/public/appointments/#{token}/cancel", params: { scope: "remaining", session: second.slot.starts_at.iso8601 }, as: :json)
      expect(response).to(have_http_status(:ok))
      expect(Appointment.joins(:slot).order("appointment_slots.starts_at").pluck(:status)).to(eq(["confirmed", "cancelled", "cancelled"]))
    end

    context "when it allows one session per week" do
      let(:allowance) { { "sessions" => 1, "per" => "week" } }

      it "takes one session in each week of the month and refuses two in the same week" do
        plan(["2026-11-03", "09:00"], ["2026-11-05", "10:00"])
        expect(response).to(have_http_status(:unprocessable_content))
        expect(Appointment.count).to(eq(0))

        plan(["2026-11-03", "09:00"], ["2026-11-10", "09:00"], ["2026-11-17", "10:00"], ["2026-11-24", "09:00"])
        expect(response).to(have_http_status(:created))
        expect(days).to(eq(["11-03", "11-10", "11-17", "11-24"]))
        expect(json["price"]["total"]).to(eq(120.0))
      end

      it "counts a week from Monday to Sunday, so Sunday and the next Monday are different weeks" do
        Forms::Definition.update(form, booking_id, { "services" => [service.merge("id" => service_id, "days" => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"])] })
        Forms::Publish.call(form: form.reload)

        plan(["2026-11-08", "09:00"], ["2026-11-09", "09:00"])
        expect(response).to(have_http_status(:created))
        expect(days).to(eq(["11-08", "11-09"]))
      end
    end

    context "with several services in one booking" do
      let(:massage) { { "name" => "Massage", "duration" => 60, "price" => 50, "currency" => "EUR", "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00", "11:00"] } }

      before do
        Forms::Definition.update(form, booking_id, { "services" => [service.merge("id" => service_id), massage], "rules" => { "multiple_services" => true, "window_days" => 90 } })
        Forms::Publish.call(form: form.reload)
      end

      it "books the plan of one service next to single sessions of another and adds the prices" do
        massage_id = form.reload.fields.find { |field| field["type"] == "booking" }["services"].last["id"]
        items = [
          { "service" => service_id, "monthly" => { "month" => "2026-11", "sessions" => [{ "date" => "2026-11-03", "time" => "09:00" }, { "date" => "2026-11-10", "time" => "09:00" }] } },
          { "service" => massage_id, "sessions" => [{ "date" => "2026-11-04", "time" => "11:00" }] },
        ]
        answers = { name_id => "Ana", mail_id => "ana@example.com", booking_id => { "items" => items } }
        post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_time_zone: "UTC" }, headers: { "CF-Connecting-IP" => "198.51.100.9" }, as: :json)

        expect(response).to(have_http_status(:created))
        expect(Appointment.count).to(eq(3))
        expect(json["price"]).to(include("total" => 170.0, "currency" => "EUR"))
      end
    end
  end

  describe "saving the allowance" do
    def update(monthly) = Forms::Definition.update(form.reload, booking_id, { "services" => [service.merge("id" => service_id, "monthly" => monthly)] })

    it "takes a number of sessions per month or per week" do
      expect { update({ "price" => 120, "sessions" => 5 }) }.not_to(raise_error)
      expect { update({ "price" => 120, "sessions" => 5, "per" => "month" }) }.not_to(raise_error)
      expect { update({ "price" => 120, "sessions" => 1, "per" => "week" }) }.not_to(raise_error)
      expect(form.reload.fields.first["services"].first["monthly"]).to(eq("price" => 120, "sessions" => 1, "per" => "week"))
    end

    it "refuses a number out of range, a period it does not know and a period without a number" do
      [{ "sessions" => 0 }, { "sessions" => 32 }, { "sessions" => 8, "per" => "week" }, { "sessions" => 2, "per" => "year" }, { "per" => "week" }, { "sessions" => "five" }].each do |extra|
        expect { update({ "price" => 120 }.merge(extra)) }.to(raise_error(ActiveRecord::RecordInvalid), extra.inspect)
      end
    end
  end

  describe "cancelling" do
    let(:token) { json["manage_url"].split("/").last }
    def rows = Appointment.joins(:slot).order("appointment_slots.starts_at").to_a

    before do
      monthly
      token
    end

    def cancel(params = {})
      post("/api/public/appointments/#{token}/cancel", params: params, as: :json)
    end

    def statuses = rows.map(&:status)

    it "shows it is a series and each session's state" do
      get("/api/public/appointments/#{token}")
      expect(json["appointment"]).to(include("series" => true))
      expect(json["appointment"]["sessions"].size).to(eq(8))
    end

    it "cancels one session and frees only its place" do
      cancel({ scope: "one", session: rows[3].slot.starts_at.iso8601 })
      expect(response).to(have_http_status(:ok))
      expect(statuses.tally).to(eq("confirmed" => 7, "cancelled" => 1))
      expect(statuses[3]).to(eq("cancelled"))
      expect(AppointmentSlot.sum(:booked)).to(eq(7))
    end

    it "cancels that session and every later one, and keeps the earlier ones" do
      cancel({ scope: "remaining", session: rows[3].slot.starts_at.iso8601 })
      expect(statuses).to(eq(["confirmed"] * 3 + ["cancelled"] * 5))
      expect(AppointmentSlot.sum(:booked)).to(eq(3))
    end

    it "cancels everything left with the default scope, and leaves sessions that already started" do
      travel_to(Time.utc(2026, 11, 10, 8, 0))
      cancel
      expect(statuses).to(eq(["confirmed"] * 3 + ["cancelled"] * 5))
    end

    it "does nothing the second time and tells nobody twice" do
      cancel({ scope: "one", session: rows[1].slot.starts_at.iso8601 })
      count = Notification.count
      cancel({ scope: "one", session: rows[1].slot.starts_at.iso8601 })
      expect(response).to(have_http_status(:ok))
      expect(Notification.count).to(eq(count))
      expect(AppointmentSlot.sum(:booked)).to(eq(7))
    end

    it "can cancel one session, then another, then the rest, each with its own notice" do
      cancel({ scope: "one", session: rows[0].slot.starts_at.iso8601 })
      cancel({ scope: "one", session: rows[1].slot.starts_at.iso8601 })
      cancel({ scope: "remaining", session: rows[2].slot.starts_at.iso8601 })
      expect(statuses.uniq).to(eq(["cancelled"]))
      expect(Notification.where(kind: "appointment_cancelled", recipient_kind: "owner", channel: "in_app").count).to(eq(3))
    end

    it "refuses a session that is not in the booking, another booking's session and a bad time" do
      monthly(name: "Bo", month: "2026-12", weekdays: ["thu"])
      other = Appointment.joins(:slot).where(client_name: "Bo").first
      ["2026-11-03T09:00:00Z", other.slot.starts_at.iso8601, "soon", ""].each do |session|
        cancel({ scope: "one", session: session })
        expect(response).to(have_http_status(:unprocessable_content), session)
      end
      expect(Appointment.where(status: "cancelled")).to(be_empty)
    end

    it "treats an unknown scope as the whole booking" do
      cancel({ scope: "everything" })
      expect(statuses.uniq).to(eq(["cancelled"]))
    end

    it "emails only the cancelled sessions" do
      perform_enqueued_jobs { cancel({ scope: "one", session: rows[2].slot.starts_at.iso8601 }) }
      mail = deliveries.find { |item| item.subject.to_s.downcase.include?("cancel") && item.to == ["ana@example.com"] }
      expect(mail.text_part.body.to_s.scan(/^- /).size).to(eq(1))
    end
  end

  describe "the owner cancelling" do
    before do
      monthly
    end

    def rows = Appointment.joins(:slot).order("appointment_slots.starts_at").to_a

    it "cancels one session, the rest of the series or everything" do
      post("/api/me/appointments/#{rows[2].id}/cancel", params: { scope: "one" }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:ok))
      expect(rows.map(&:status).count("cancelled")).to(eq(1))
      post("/api/me/appointments/#{rows[4].id}/cancel", params: { scope: "remaining" }, headers: auth_headers, as: :json)
      expect(rows.map(&:status).count("cancelled")).to(eq(5))
      post("/api/me/appointments/#{rows[0].id}/cancel", headers: auth_headers, as: :json)
      expect(rows.map(&:status).uniq).to(eq(["cancelled"]))
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
    end

    it "tells the client but not the owner, and marks the agenda rows as a series" do
      post("/api/me/appointments/#{rows[1].id}/cancel", params: { scope: "one" }, headers: auth_headers, as: :json)
      expect(Notification.where(kind: "appointment_cancelled", recipient_kind: "owner")).to(be_empty)
      get("/api/me/agenda", params: { from: "2026-11-01", to: "2026-11-30" }, headers: auth_headers)
      expect(JSON.parse(response.body)["sessions"].flat_map { |session| session["appointments"] }.map { |row| row["series"] }.uniq).to(eq([true]))
    end

    it "refuses it for another owner's appointment" do
      other = FactoryBot.create(:user)
      post("/api/me/appointments/#{rows[1].id}/cancel", params: { scope: "one" }, headers: { "Authorization" => "Bearer #{SessionToken.issue(other)}" }, as: :json)
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "setting it" do
    def update(monthly)
      patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { services: [service.merge("id" => service_id, "monthly" => monthly)] }, headers: auth_headers, as: :json)
    end

    it "takes an empty object, a price with a currency, and nothing" do
      [{}, { price: 99.5 }, nil].each do |value|
        update(value)
        expect(response).to(have_http_status(:ok), value.inspect)
      end
    end

    it "refuses a negative price and a price without a currency, and drops keys it does not know" do
      update(price: -1)
      expect(response).to(have_http_status(:unprocessable_content))
      patch("/api/me/forms/#{form.id}/fields/#{booking_id}", params: { services: [service.except("price", "currency").merge("id" => service_id, "monthly" => { price: 10 })] }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:unprocessable_content))
      update(price: 10, plan: "gold")
      expect(form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["monthly"]).to(eq("price" => 10.0))
    end

    it "shows the public form which services offer it, with the informative price" do
      get("/api/public/forms/#{form.public_id}", headers: { "CF-Connecting-IP" => "198.51.100.9" })
      booking = JSON.parse(response.body)["form"]["fields"].find { |field| field["type"] == "booking" }
      expect(booking["services"].first["monthly"]).to(eq("price" => 120))
    end
  end
end
