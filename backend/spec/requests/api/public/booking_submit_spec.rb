require "rails_helper"

RSpec.describe("booking through POST /api/public/forms/:public_id/responses", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:service) { { "name" => "Haircut", "duration" => 60, "price" => 25, "currency" => "EUR", "capacity" => 1, "days" => ["mon", "tue", "wed"], "times" => ["09:00", "10:00", "11:00"] } }
  let(:rules) { {} }
  let(:form) { Form.create!(user: current_user, title: "Salon") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
  let(:service_id) { form.reload.fields.find { |field| field["type"] == "booking" }["services"].first["id"] }

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

  def json
    JSON.parse(response.body)
  end

  def sessions(*pairs)
    pairs.map { |date, time| { "date" => date, "time" => time } }
  end

  def book(list = sessions(["2026-11-03", "09:00"]), extra: {}, ip: "198.51.100.7", answers: {})
    body = {
      answers: { name_id => "Ana", mail_id => "ana@example.com", booking_id => { "service" => service_id, "sessions" => list } }.merge(answers),
      turnstile_token: "t",
    }.merge(extra)
    post("/api/public/forms/#{form.public_id}/responses", params: body, headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  def slot_at(time)
    AppointmentSlot.find_by(form_id: form.id, starts_at: time)
  end

  describe "a successful booking" do
    it "stores the response, reserves the place and confirms the appointment at once" do
      expect { book }.to(change(FormResponse, :count).by(1).and(change(Appointment, :count).by(1)))
      expect(response).to(have_http_status(:created))
      expect(json.except("manage_url")).to(eq("ok" => true, "appointments" => [{ "starts_at" => "2026-11-03T09:00:00Z", "service" => "Haircut", "status" => "confirmed" }], "email_delivery" => "queued", "price" => { "total" => 25.0, "currency" => "EUR", "free_sessions" => 0 }))
      expect(slot_at(Time.utc(2026, 11, 3, 9))).to(have_attributes(booked: 1, capacity: 1))

      appointment = Appointment.last
      expect(appointment).to(have_attributes(status: "confirmed", client_name: "Ana", client_email: "ana@example.com", form_id: form.id, response_id: FormResponse.last.id, published_version: 1))
      expect(appointment.snapshot).to(eq("name" => "Haircut", "duration" => 60, "price" => 25, "currency" => "EUR", "total" => 25.0, "free_sessions" => 0, "sessions" => 1))
      expect(FormResponse.last.answers[name_id]).to(eq("Ana"))
    end

    it "hands back a manage link that opens exactly this booking" do
      book(sessions(["2026-11-03", "09:00"], ["2026-11-04", "10:00"]))
      token = json["manage_url"][%r{/m/(.+)\z}, 1]

      expect(json["manage_url"]).to(start_with("https://kurz.fyi/m/"))
      expect(AppointmentToken.resolve(token)).to(eq(Appointment.order(:id).first))
      expect(AppointmentToken.last.expires_at).to(eq(Time.utc(2026, 11, 4, 10) + 7.days))
    end

    it "books several days at once under one group" do
      book(sessions(["2026-11-03", "09:00"], ["2026-11-04", "10:00"]))
      expect(response).to(have_http_status(:created))
      expect(json["appointments"].map { |item| item["starts_at"] }).to(eq(["2026-11-03T09:00:00Z", "2026-11-04T10:00:00Z"]))
      expect(Appointment.pluck(:group_key).uniq.size).to(eq(1))
    end

    it "keeps the visitor's time zone and language when valid and ignores them when not" do
      book(extra: { client_time_zone: "America/Sao_Paulo", client_locale: "pt-PT" })
      expect(Appointment.last).to(have_attributes(client_time_zone: "America/Sao_Paulo", client_locale: "pt-PT"))

      book(sessions(["2026-11-03", "10:00"]), extra: { client_time_zone: "Mars/Olympus", client_locale: "xx" })
      expect(response).to(have_http_status(:created))
      expect(Appointment.last).to(have_attributes(client_time_zone: nil, client_locale: nil))
    end

    it "returns the same booking for a retried idempotency key without booking again" do
      book(extra: { idempotency_key: "k1" })
      book(extra: { idempotency_key: "k1" })
      expect(response).to(have_http_status(:ok))
      expect(json["appointments"].size).to(eq(1))
      expect(Appointment.count).to(eq(1))
      expect(slot_at(Time.utc(2026, 11, 3, 9)).booked).to(eq(1))
    end

    it "does not need the booking details in the stored answers beyond service and sessions" do
      book
      expect(FormResponse.last.answers[booking_id].keys).to(match_array(["service", "sessions"]))
    end
  end

  describe "manual approval" do
    let(:rules) { { "approval" => "manual", "approval_timeout_minutes" => 90 } }

    it "records the booking as pending, holding the place until the deadline" do
      book
      expect(response).to(have_http_status(:created))
      expect(json["appointments"].first["status"]).to(eq("pending"))
      expect(Appointment.last).to(have_attributes(status: "pending", expires_at: now + 90.minutes))
      expect(slot_at(Time.utc(2026, 11, 3, 9)).booked).to(eq(1))
    end

    it "asks the owner to approve and tells the client the request was received" do
      book
      expect(Notification.pluck(:channel, :kind, :recipient_kind)).to(match_array([["in_app", "appointment_requested", "owner"], ["email", "appointment_requested", "owner"], ["email", "appointment_request_received", "client"]]))
    end

    it "refuses a second request for the same time while the first is waiting" do
      book(extra: { idempotency_key: "a" })
      book(extra: { idempotency_key: "b" }, ip: "198.51.100.8")
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "reports the pending status on the manage page" do
      book
      get("/api/public/appointments/#{json["manage_url"][%r{/m/(.+)\z}, 1]}")
      expect(json["appointment"]["status"]).to(eq("pending"))
    end

    it "sends neither a confirmation nor a reminder before a decision" do
      book
      Appointments::SendReminders.call(now: Time.utc(2026, 11, 2, 9, 5))
      expect(Notification.where(kind: ["appointment_confirmed", "appointment_reminder"])).to(be_empty)
    end
  end

  describe "places" do
    it "refuses a time that is already taken and stores nothing from that request" do
      book(extra: { idempotency_key: "a" })
      expect { book(extra: { idempotency_key: "b" }, ip: "198.51.100.8") }.not_to(change { [FormResponse.count, Appointment.count] })
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["errors"]["answers"][booking_id]).to(eq(["unavailable"]))
      expect(slot_at(Time.utc(2026, 11, 3, 9)).booked).to(eq(1))
    end

    it "answers 409 when the time is taken between the check and the reservation" do
      allow(Appointments::Reserve).to(receive(:call).and_raise(Appointments::Reserve::Full.new(Time.utc(2026, 11, 3, 9))))
      expect { book }.not_to(change { [FormResponse.count, Appointment.count] })
      expect(response).to(have_http_status(:conflict))
      expect(json).to(eq("error" => "slot_full", "starts_at" => "2026-11-03T09:00:00Z"))
    end

    it "is all or nothing: one full day cancels the whole request, including the response" do
      book(sessions(["2026-11-04", "10:00"]), extra: { idempotency_key: "a" })
      expect { book(sessions(["2026-11-03", "09:00"], ["2026-11-04", "10:00"]), extra: { idempotency_key: "b" }, ip: "198.51.100.8") }.not_to(change { [FormResponse.count, Appointment.count] })
      expect(slot_at(Time.utc(2026, 11, 3, 9))).to(be_nil.or(have_attributes(booked: 0)))
    end

    it "lets many visitors book a service with unlimited places" do
      Forms::Definition.update(form.reload, booking_id, { "services" => [service.merge("id" => service_id, "capacity" => nil)] })
      Forms::Publish.call(form: form.reload)
      3.times { |index| book(extra: {}, ip: "198.51.100.#{10 + index}") }
      expect(Appointment.count).to(eq(3))
    end

    it "gives a place back when the owner deletes the response" do
      book
      delete("/api/me/forms/#{form.id}/responses/#{FormResponse.last.id}", headers: auth_headers)
      expect(response).to(have_http_status(:no_content))
      expect(slot_at(Time.utc(2026, 11, 3, 9)).booked).to(eq(0))
      expect(Appointment.count).to(eq(0))
      book(extra: {}, ip: "198.51.100.9")
      expect(response).to(have_http_status(:created))
    end

    it "gives every place back when the owner deletes all responses" do
      book
      book(sessions(["2026-11-04", "10:00"]), ip: "198.51.100.8")
      delete("/api/me/forms/#{form.id}/responses", headers: auth_headers)
      expect(AppointmentSlot.pluck(:booked)).to(all(eq(0)))
    end
  end

  describe "what cannot be booked" do
    {
      "a time in the past" => [["2026-11-02", "07:00"]],
      "a time the service does not offer" => [["2026-11-03", "09:30"]],
      "a day the service does not run" => [["2026-11-05", "09:00"]],
      "a day beyond the booking window" => [["2027-03-02", "09:00"]],
      "the same time twice" => [["2026-11-03", "09:00"], ["2026-11-03", "09:00"]],
      "a malformed date" => [["03/11/2026", "09:00"]],
      "a malformed time" => [["2026-11-03", "9am"]],
    }.each do |label, pairs|
      it "rejects #{label} and stores nothing" do
        expect { book(sessions(*pairs)) }.not_to(change { [FormResponse.count, Appointment.count, AppointmentSlot.count] })
        expect(response).to(have_http_status(:unprocessable_content))
      end
    end

    it "rejects no sessions, more than 31 sessions and sessions that are not a list" do
      [[], Array.new(32) { |index| { "date" => "2026-11-03", "time" => format("%02d:00", index % 24) } }, "09:00"].each do |list|
        book(list)
        expect(response).to(have_http_status(:unprocessable_content))
      end
    end

    it "rejects an unknown service and a booking that is not an object" do
      book(answers: { booking_id => { "service" => "nope0000", "sessions" => sessions(["2026-11-03", "09:00"]) } })
      expect(response).to(have_http_status(:unprocessable_content))
      book(answers: { booking_id => "tomorrow" })
      expect(response).to(have_http_status(:unprocessable_content))
      expect(Appointment.count).to(eq(0))
    end

    it "requires the booking, the name and the email" do
      post("/api/public/forms/#{form.public_id}/responses", params: { answers: { name_id => "Ana", mail_id => "ana@example.com" }, turnstile_token: "t" }, headers: { "CF-Connecting-IP" => "198.51.100.7" }, as: :json)
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["errors"]["answers"]).to(have_key(booking_id))

      book(answers: { mail_id => "" })
      expect(json["errors"]["answers"]).to(have_key(mail_id))
    end

    it "does not take a booking for an unpublished form" do
      Forms::Unpublish.call(form: form.reload)
      book
      expect(response).to(have_http_status(:not_found))
    end
  end

  describe "rules" do
    let(:rules) { { "min_notice_minutes" => 150, "max_per_day" => 1 } }

    it "enforces the minimum notice" do
      travel_to(Time.utc(2026, 11, 3, 7, 30)) { book(sessions(["2026-11-03", "09:00"])) }
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "closes the day once the per-day limit is reached" do
      Forms::Definition.update(form.reload, booking_id, { "services" => [service.merge("id" => service_id, "capacity" => 5)] })
      Forms::Publish.call(form: form.reload)
      book(sessions(["2026-11-03", "10:00"]))
      expect(response).to(have_http_status(:created))
      book(sessions(["2026-11-03", "11:00"]), ip: "198.51.100.8")
      expect(response).to(have_http_status(:unprocessable_content))
    end
  end

  describe "the snapshot" do
    it "books against the published services, not the draft" do
      Forms::Publish.call(form: form.reload)
      Forms::Definition.update(form.reload, booking_id, { "services" => [service.merge("id" => service_id, "times" => ["14:00"])] })
      book
      expect(response).to(have_http_status(:created))
      book(sessions(["2026-11-03", "14:00"]), ip: "198.51.100.8")
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "answers 409 form_changed for an old version before touching any place" do
      Forms::Publish.call(form: form.reload)
      expect { book(extra: { form_version: 1 }) }.not_to(change { [FormResponse.count, Appointment.count] })
      expect(response).to(have_http_status(:conflict))
      expect(json["error"]).to(eq("form_changed"))
    end
  end

  describe "abuse protection stays in place" do
    it "still answers 429 after 30 submissions from one IP" do
      Forms::Definition.update(form.reload, booking_id, { "services" => [service.merge("id" => service_id, "capacity" => nil)] })
      Forms::Publish.call(form: form.reload)
      30.times { book }
      book
      expect(response).to(have_http_status(:too_many_requests))
    end

    it "still refuses a failed captcha" do
      allow(Turnstile).to(receive(:check).and_return(:rejected))
      expect { book }.not_to(change { [FormResponse.count, Appointment.count] })
      expect(response).to(have_http_status(:forbidden))
    end
  end
end
