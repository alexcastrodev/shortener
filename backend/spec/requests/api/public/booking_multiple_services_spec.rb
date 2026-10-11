require "rails_helper"

RSpec.describe("several services in one booking", type: :request) do
  include_context "authenticated user"
  include ActiveJob::TestHelper

  let(:now) { Time.utc(2026, 11, 2, 8, 0) }
  let(:days) { ["mon", "tue", "wed"] }
  let(:guitar) { { "name" => "Guitar", "duration" => 60, "price" => 40, "currency" => "EUR", "capacity" => 1, "days" => days, "times" => ["09:00", "10:00", "11:00"], "monthly" => { "price" => 300 } } }
  let(:drums) { { "name" => "Drums", "duration" => 60, "price" => 50, "currency" => "EUR", "capacity" => 1, "days" => days, "times" => ["09:00", "10:00", "11:00", "14:00"], "monthly" => { "price" => 350 } } }
  let(:rules) { { "multiple_services" => true } }
  let(:form) { Form.create!(user: current_user, title: "Music") }
  let(:booking_id) { form.reload.fields.find { |field| field["type"] == "booking" }["id"] }
  let(:name_id) { form.reload.fields.find { |field| field["type"] == "short_text" }["id"] }
  let(:mail_id) { form.reload.fields.find { |field| field["type"] == "email" }["id"] }
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
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [guitar, drums], "rules" => rules })
    Forms::Definition.add(form.reload, { "type" => "short_text", "label" => "Name", "required" => true })
    Forms::Definition.add(form.reload, { "type" => "email", "label" => "Email", "required" => true })
    Forms::Publish.call(form: form.reload)
  end

  def json = JSON.parse(response.body)

  def service_id(name) = form.reload.fields.find { |field| field["type"] == "booking" }["services"].find { |item| item["name"] == name }["id"]

  def singles(name, *pairs) = { "service" => service_id(name), "sessions" => pairs.map { |date, time| { "date" => date, "time" => time } } }

  def monthly(name, time: "10:00", weekdays: ["wed"]) = { "service" => service_id(name), "monthly" => { "month" => "2026-11", "weekdays" => weekdays, "time" => time } }

  def submit(answer, who: "Ana", ip: "198.51.100.7")
    answers = { name_id => who, mail_id => "#{who.downcase}@example.com", booking_id => answer }
    post("/api/public/forms/#{form.public_id}/responses", params: { answers: answers, turnstile_token: "t", confirm_field_id: mail_id, client_time_zone: "UTC" }, headers: { "CF-Connecting-IP" => ip }, as: :json)
  end

  def items(*list) = { "items" => list }

  def unavailable? = json.dig("errors", "answers", booking_id) == ["unavailable"]

  describe "booking two services at once" do
    it "books each service under one group and adds every price" do
      expect { submit(items(singles("Guitar", ["2026-11-03", "09:00"], ["2026-11-04", "09:00"]), singles("Drums", ["2026-11-03", "14:00"]))) }.to(change(Appointment, :count).by(3))

      expect(response).to(have_http_status(:created))
      expect(json["appointments"].map { |item| [item["service"], item["starts_at"]] }).to(eq([["Guitar", "2026-11-03T09:00:00Z"], ["Drums", "2026-11-03T14:00:00Z"], ["Guitar", "2026-11-04T09:00:00Z"]]))
      expect(json["price"]).to(eq("total" => 130.0, "currency" => "EUR"))
      expect(Appointment.pluck(:group_key).uniq.size).to(eq(1))
      expect(Appointment.pluck(:snapshot).map { |snapshot| [snapshot["name"], snapshot["price"], snapshot["total"], snapshot["sessions"]] }.uniq).to(contain_exactly(["Guitar", 40, 130.0, 3], ["Drums", 50, 130.0, 3]))
      expect(FormResponse.last.answers[booking_id]).to(eq("items" => [
        { "service" => service_id("Guitar"), "sessions" => [{ "date" => "2026-11-03", "time" => "09:00", "duration" => 60 }, { "date" => "2026-11-04", "time" => "09:00", "duration" => 60 }] },
        { "service" => service_id("Drums"), "sessions" => [{ "date" => "2026-11-03", "time" => "14:00", "duration" => 60 }] },
      ]))
    end

    it "mixes single sessions of one service with the monthly booking of another" do
      expect { submit(items(singles("Guitar", ["2026-11-03", "09:00"]), monthly("Drums"))) }.to(change(Appointment, :count).by(5))

      expect(response).to(have_http_status(:created))
      expect(json["price"]).to(eq("total" => 390.0, "currency" => "EUR"))
      expect(Appointment.joins(:slot).where(appointment_slots: { service_key: service_id("Drums") }).count).to(eq(4))
      expect(json["skipped"]).to(be_nil.or(eq([])))
    end

    it "takes one service in the items shape too, and a legacy answer while the rule is on" do
      submit(items(singles("Guitar", ["2026-11-03", "09:00"])))
      expect(response).to(have_http_status(:created))
      expect(FormResponse.last.answers[booking_id]).to(have_key("items"))

      submit(singles("Drums", ["2026-11-03", "14:00"]), who: "Bo", ip: "198.51.100.8")
      expect(response).to(have_http_status(:created))
      expect(FormResponse.last.answers[booking_id]).to(include("service" => service_id("Drums")))
    end
  end

  describe "what one person cannot do" do
    it "refuses two services at the same time and reserves nothing" do
      expect { submit(items(singles("Guitar", ["2026-11-03", "09:00"]), singles("Drums", ["2026-11-03", "09:00"]))) }.not_to(change { [Appointment.count, AppointmentSlot.count] })
      expect(response).to(have_http_status(:unprocessable_content))
      expect(unavailable?).to(be(true))
    end

    context "with a gap between sessions" do
      let(:rules) { { "multiple_services" => true, "buffer_minutes" => 30 } }

      it "counts the gap between sessions of different services" do
        submit(items(singles("Guitar", ["2026-11-03", "09:00"]), singles("Drums", ["2026-11-03", "10:00"])))
        expect(response).to(have_http_status(:unprocessable_content))

        expect { submit(items(singles("Guitar", ["2026-11-03", "09:00"]), singles("Drums", ["2026-11-03", "11:00"])), ip: "198.51.100.8") }.to(change(Appointment, :count).by(2))
        expect(response).to(have_http_status(:created))
      end
    end

    context "with a limit per day" do
      let(:rules) { { "multiple_services" => true, "max_per_day" => 2 } }

      it "counts the sessions of every service of the day" do
        expect { submit(items(singles("Guitar", ["2026-11-03", "09:00"], ["2026-11-03", "10:00"]), singles("Drums", ["2026-11-03", "14:00"]))) }.not_to(change(Appointment, :count))
        expect(response).to(have_http_status(:unprocessable_content))

        expect { submit(items(singles("Guitar", ["2026-11-03", "09:00"]), singles("Drums", ["2026-11-03", "14:00"])), ip: "198.51.100.8") }.to(change(Appointment, :count).by(2))
        expect(response).to(have_http_status(:created))
      end
    end

    it "refuses the whole request when one service is already full" do
      submit(items(singles("Guitar", ["2026-11-03", "09:00"])), who: "Bo", ip: "198.51.100.8")

      expect { submit(items(singles("Drums", ["2026-11-03", "14:00"]), singles("Guitar", ["2026-11-03", "09:00"]))) }.not_to(change(Appointment, :count))
      expect(unavailable?).to(be(true))
      expect(AppointmentSlot.where(service_key: service_id("Drums")).count).to(eq(0))
    end
  end

  describe "what the owner has not allowed" do
    let(:rules) { {} }

    it "refuses the items shape when the rule is off, and keeps the legacy shape working" do
      expect { submit(items(singles("Guitar", ["2026-11-03", "09:00"]))) }.not_to(change(Appointment, :count))
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json.dig("errors", "answers", booking_id)).to(eq(["invalid"]))

      submit(singles("Guitar", ["2026-11-03", "09:00"]), ip: "198.51.100.8")
      expect(response).to(have_http_status(:created))
    end
  end

  describe "the answer it accepts" do
    let(:booking) { Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" } }

    it "refuses a service twice, too many items, an empty list, no list and stray keys" do
      one = singles("Guitar", ["2026-11-03", "09:00"])
      other = singles("Drums", ["2026-11-03", "14:00"])
      ["no list", [], [one, one], Array.new(6) { one }].each do |list|
        expect(Appointments::Book.items_of({ "items" => list }, booking, nil)).to(be_nil)
      end
      expect(Appointments::Book.items_of({ "items" => [one], "service" => "x" }, booking, nil)).to(be_nil)
      expect(Appointments::Book.items_of({ "items" => [one, other] }, booking, nil)).to(eq([one, other]))
    end

    it "refuses a service the form does not have" do
      submit(items(singles("Guitar", ["2026-11-03", "09:00"]), singles("Drums", ["2026-11-03", "14:00"]).merge("service" => "nope0001")))
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json.dig("errors", "answers", booking_id)).to(eq(["invalid"]))
    end

    it "is never used to claim a place from the waiting list" do
      expect(Appointments::Book.items_of({ "items" => [singles("Guitar", ["2026-11-03", "09:00"])] }, booking, Time.utc(2026, 11, 3, 9))).to(be_nil)
    end

    it "refuses prices in two currencies even if they were stored" do
      mixed = booking.merge("services" => booking["services"].each_with_index.map { |service, index| index.zero? ? service : service.merge("currency" => "USD") })
      list = [singles("Guitar", ["2026-11-03", "09:00"]), singles("Drums", ["2026-11-03", "14:00"])]
      expect(Appointments::Book.items_of({ "items" => list }, mixed, nil)).to(be_nil)
    end
  end

  describe "saving the rule" do
    it "needs one currency and no categories" do
      expect { Forms::Definition.update(form, booking_id, { "services" => [guitar.merge("id" => service_id("Guitar")), drums.merge("id" => service_id("Drums"), "currency" => "USD")] }) }.to(raise_error(ActiveRecord::RecordInvalid, /same currency/))
      two = [{ "id" => "cat00001", "name" => "Strings" }, { "id" => "cat00002", "name" => "Skins" }]
      services = [guitar.merge("id" => service_id("Guitar"), "category_id" => "cat00001"), drums.merge("id" => service_id("Drums"), "category_id" => "cat00002")]
      expect { Forms::Definition.update(form.reload, booking_id, { "categories" => two, "services" => services }) }.to(raise_error(ActiveRecord::RecordInvalid, /categories/))
    end
  end

  describe "afterwards" do
    before { submit(items(singles("Guitar", ["2026-11-03", "09:00"], ["2026-11-04", "09:00"]), singles("Drums", ["2026-11-03", "14:00"]))) }

    it "tells the client and the owner every service, with the length of each session" do
      perform_enqueued_jobs { Notification.where(channel: "email").pluck(:id).each { |id| Notifications::Deliver.call(id: id) } }

      client = deliveries.find { |mail| mail.to == ["ana@example.com"] }
      text = client.text_part.body.decoded
      expect(client.subject).to(eq("Confirmed: Guitar, Drums · Tue 3 Nov, 09:00"))
      expect(text).to(include("Service: Guitar, Drums"))
      expect(text).to(include("- Guitar · Tuesday 3 November · 09:00–10:00", "- Drums · Tuesday 3 November · 14:00–15:00", "- Guitar · Wednesday 4 November · 09:00–10:00"))
      expect(text).to(include("Total: €130.00"))
      expect(deliveries.find { |mail| mail.to == [current_user.email] }.subject).to(include("Guitar, Drums"))
    end

    it "shows the whole booking on the manage page, each session with its service" do
      token = AppointmentToken.issue(booking: Appointment.order(:id).first, expires_at: now + 30.days)
      get("/api/public/appointments/#{token}")

      expect(json["appointment"]["service"]).to(eq("Guitar, Drums"))
      expect(json["appointment"]["sessions"].map { |session| session.values_at("service", "duration") }).to(eq([["Guitar", 60], ["Drums", 60], ["Guitar", 60]]))
    end

    it "cancels the remaining sessions of one service and leaves the others" do
      target = Appointment.joins(:slot).where(appointment_slots: { service_key: service_id("Guitar") }).order("appointment_slots.starts_at").first
      Appointments::ClientCancel.call(appointment: target, scope: "remaining")

      expect(Appointment.joins(:slot).where(status: "cancelled").pluck("appointment_slots.service_key").uniq).to(eq([service_id("Guitar")]))
      expect(Appointment.where(status: "confirmed").count).to(eq(1))
    end
  end
end
