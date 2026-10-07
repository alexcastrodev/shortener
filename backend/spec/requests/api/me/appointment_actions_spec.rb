require "rails_helper"

RSpec.describe("owner actions on an appointment: reschedule and remind", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:other) { FactoryBot.create(:user) }
  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:rules) { { "approval" => "auto", "min_notice_minutes" => 4_320 } }
  let(:service) { { "name" => "Haircut", "duration" => 60, "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "10:00", "11:00"] } }
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
    book([["2026-11-09", "09:00"], ["2026-11-10", "10:00"]])
    deliveries.clear
  end

  def json = JSON.parse(response.body)

  def book(list, name: "Ana", ip: "198.51.100.7", locale: "en")
    sessions = list.map { |date, time| { "date" => date, "time" => time } }
    answers = { name_id => name, mail_id => "#{name.downcase}@example.com", booking_id => { "service" => service_id, "sessions" => sessions } }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", client_locale: locale, client_time_zone: "Europe/Lisbon" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  def first_row = Appointment.joins(:slot).order("appointment_slots.starts_at").first

  def reschedule(row, params, headers: auth_headers)
    post("/api/me/appointments/#{row.id}/reschedule", params: params, headers: headers, as: :json)
  end

  def remind(row, headers: auth_headers)
    post("/api/me/appointments/#{row.id}/remind", headers: headers)
  end

  def fresh_headers = { "Authorization" => "Bearer #{SessionToken.issue(current_user)}" }

  def slot_booked(time) = AppointmentSlot.find_by(starts_at: time)&.booked

  describe "access" do
    it "answers 401 without a token, 404 with the feature off and 404 for another owner's appointment" do
      row = first_row
      post("/api/me/appointments/#{row.id}/reschedule", params: { date: "2026-11-11", time: "09:00" }, as: :json)
      expect(response).to(have_http_status(:unauthorized))
      post("/api/me/appointments/#{row.id}/remind")
      expect(response).to(have_http_status(:unauthorized))

      reschedule(row, { date: "2026-11-11", time: "09:00" }, headers: { "Authorization" => "Bearer #{SessionToken.issue(other)}" })
      expect(response).to(have_http_status(:not_found))
      remind(row, headers: { "Authorization" => "Bearer #{SessionToken.issue(other)}" })
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "rescheduling one session" do
    it "moves it, swaps the places, links to the old one and tells the client what changed" do
      row = first_row
      row.update!(reminder_sent_at: now)
      old_slot = row.slot.starts_at
      perform_enqueued_jobs { reschedule(row, { date: "2026-11-11", time: "11:00", message: "Sorry, I am out" }) }

      expect(response).to(have_http_status(:ok))
      moved = Appointment.find(json["appointment"]["id"])
      expect(moved).to(have_attributes(status: "confirmed", rescheduled_from_id: row.id, group_key: row.group_key, response_id: row.response_id, reminder_sent_at: nil, decision_message: "Sorry, I am out"))
      expect(moved.slot.starts_at).to(eq(Time.utc(2026, 11, 11, 11)))
      expect(row.reload.status).to(eq("rescheduled"))
      expect(slot_booked(old_slot)).to(eq(0))
      expect(slot_booked(Time.utc(2026, 11, 11, 11))).to(eq(1))
      expect(slot_booked(Time.utc(2026, 11, 10, 10))).to(eq(1))

      expect(deliveries.map(&:to)).to(eq([["ana@example.com"]]))
      body = deliveries.last.text_part.body.to_s
      expect(deliveries.last.subject).to(start_with("Time changed: Haircut"))
      expect(body).to(include("Was: 2026-11-09 09:00 (Europe/Lisbon)", "Now: 2026-11-11 11:00 (Europe/Lisbon)", "Sorry, I am out"))
      expect(body).not_to(include("2026-11-09 09:00\n"))
    end

    it "uses the client's language" do
      Appointment.update_all(client_locale: "pt-PT")
      perform_enqueued_jobs { reschedule(first_row, { date: "2026-11-11", time: "09:00" }) }
      expect(deliveries.last.subject).to(start_with("Horário alterado: Haircut"))
    end

    it "keeps one booking: the client page, the agenda and the places show only the live sessions" do
      row = first_row
      reschedule(row, { date: "2026-11-11", time: "09:00" })
      token = AppointmentToken.issue(booking: row, expires_at: now + 30.days)
      get("/api/public/appointments/#{token}")
      expect(json["appointment"]["sessions"].map { |item| item["starts_at"] }).to(eq(["2026-11-10T10:00:00Z", "2026-11-11T09:00:00Z"]))

      get("/api/me/agenda", params: { from: "2026-11-09", to: "2026-11-12" }, headers: auth_headers)
      booked = json["sessions"].select { |item| item["booked"].positive? }.map { |item| item["starts_at"] }
      expect(booked).to(eq(["2026-11-10T10:00:00Z", "2026-11-11T09:00:00Z"]))
    end

    it "lets the client cancel the moved booking and frees the new place only" do
      row = first_row
      reschedule(row, { date: "2026-11-11", time: "09:00" })
      token = AppointmentToken.issue(booking: row, expires_at: now + 30.days)
      post("/api/public/appointments/#{token}/cancel", as: :json)
      expect(AppointmentSlot.sum(:booked)).to(eq(0))
      expect(Appointment.pluck(:status).tally).to(eq("rescheduled" => 1, "cancelled" => 2))
    end

    it "keeps a pending request pending, with its deadline" do
      row = first_row
      expires = now + 1.day
      Appointment.where(group_key: row.group_key).update_all(status: "pending", expires_at: expires)
      reschedule(row.reload, { date: "2026-11-11", time: "09:00" })
      expect(Appointment.find(json["appointment"]["id"])).to(have_attributes(status: "pending", expires_at: expires))
    end

    it "lets the owner pick a time inside the minimum notice, but only one the service offers" do
      reschedule(first_row, { date: "2026-11-03", time: "09:00" })
      expect(response).to(have_http_status(:ok))
      reschedule(Appointment.find_by(rescheduled_from_id: nil, status: "confirmed"), { date: "2026-11-11", time: "09:30" })
      expect(response).to(have_http_status(:conflict))
      expect(json["error"]).to(eq("unavailable"))
    end

    it "lets the owner drop a session on any future time with force, and still tells the client" do
      row = first_row
      perform_enqueued_jobs { reschedule(row, { date: "2026-11-14", time: "09:30", force: true }) }

      expect(response).to(have_http_status(:ok))
      moved = Appointment.find(json["appointment"]["id"])
      expect(moved.slot.starts_at).to(eq(Time.utc(2026, 11, 14, 9, 30)))
      expect(row.reload.status).to(eq("rescheduled"))
      expect(deliveries.map(&:to)).to(eq([["ana@example.com"]]))
      expect(deliveries.last.text_part.body.to_s).to(include("Now: 2026-11-14 09:30 (Europe/Lisbon)"))
    end

    it "keeps force from moving a session into the past, onto a full time or with a bad time" do
      book([["2026-11-11", "09:00"]], name: "Bo", ip: "198.51.100.8")
      row = first_row
      expect { reschedule(row, { date: "2026-11-11", time: "09:00", force: true }) }.not_to(change { [Appointment.count, AppointmentSlot.pluck(:starts_at, :booked)] })
      expect(response).to(have_http_status(:conflict))
      reschedule(row, { date: "2026-11-01", time: "09:00", force: true })
      expect(response).to(have_http_status(:conflict))
      reschedule(row, { date: "2026-11-12", time: "25:99", force: true })
      expect(response).to(have_http_status(:conflict))
      expect(row.reload.status).to(eq("confirmed"))
    end

    it "refuses a taken time and changes nothing" do
      book([["2026-11-11", "09:00"]], name: "Bo", ip: "198.51.100.8")
      row = first_row
      expect { reschedule(row, { date: "2026-11-11", time: "09:00" }) }.not_to(change { [Appointment.count, AppointmentSlot.pluck(:starts_at, :booked)] })
      expect(response).to(have_http_status(:conflict))
      expect(row.reload.status).to(eq("confirmed"))
    end

    it "refuses the same time, a closed day, a malformed date and a session that already passed" do
      row = first_row
      reschedule(row, { date: "2026-11-09", time: "09:00" })
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["error"]).to(eq("same_time"))
      reschedule(row, { date: "2026-11-14", time: "09:00" })
      expect(response).to(have_http_status(:conflict))
      reschedule(row, { date: "soon", time: "09:00" })
      expect(response).to(have_http_status(:conflict))

      travel_to(Time.utc(2026, 11, 9, 12)) { reschedule(row, { date: "2026-11-11", time: "09:00" }, headers: fresh_headers) }
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["error"]).to(eq("not_reschedulable"))
    end

    it "refuses a cancelled or already moved appointment" do
      row = first_row
      reschedule(row, { date: "2026-11-11", time: "09:00" })
      reschedule(row.reload, { date: "2026-11-12", time: "09:00" })
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "never sends an email without an address" do
      Appointment.update_all(client_email: nil)
      expect { perform_enqueued_jobs { reschedule(first_row, { date: "2026-11-11", time: "09:00" }) } }.not_to(change { Notification.where(kind: "appointment_rescheduled").count })
      expect(response).to(have_http_status(:ok))
    end
  end

  describe "reminding now" do
    it "sends the reminder with the confirmed sessions, without touching the automatic one" do
      row = first_row
      perform_enqueued_jobs { remind(row) }
      expect(response).to(have_http_status(:accepted))
      expect(deliveries.map(&:to)).to(eq([["ana@example.com"]]))
      expect(deliveries.last.subject).to(start_with("Reminder: Haircut"))
      expect(Appointment.pluck(:reminder_sent_at).compact).to(eq([]))
    end

    it "allows one an hour and says when it is too soon" do
      row = first_row
      remind(row)
      expect(response).to(have_http_status(:accepted))
      remind(row)
      expect(response).to(have_http_status(:too_many_requests))
      expect(json["error"]).to(eq("too_soon"))
      expect(Notification.where(kind: "appointment_reminder").count).to(eq(1))

      travel_to(now + 61.minutes) { remind(row, headers: fresh_headers) }
      expect(response).to(have_http_status(:accepted))
    end

    it "has nothing to remind for a pending, cancelled or past booking" do
      row = first_row
      Appointment.update_all(status: "pending")
      remind(row)
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["error"]).to(eq("nothing_to_remind"))

      Appointment.update_all(status: "confirmed")
      travel_to(Time.utc(2026, 11, 12)) { remind(row, headers: fresh_headers) }
      expect(json["error"]).to(eq("nothing_to_remind"))
    end

    it "says when the client left no email" do
      Appointment.update_all(client_email: nil)
      remind(first_row)
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["error"]).to(eq("no_email"))
    end
  end
end
