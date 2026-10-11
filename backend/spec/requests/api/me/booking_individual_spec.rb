require "rails_helper"

RSpec.describe("the individual booking question", type: :request) do
  include_context "authenticated user"

  let(:form) { Form.create!(user: current_user, title: "Teacher") }
  let(:lesson) { { name: "Math", duration: 60, price: 30, currency: "EUR", capacity: 1 } }
  let(:availability) { { days: ["mon", "tue", "wed"], times: ["09:00", "10:00"] } }
  let(:email) { { "id" => "mail0001", "type" => "email", "label" => "Email", "required" => true } }
  let(:name) { { "id" => "name0001", "type" => "short_text", "label" => "Name", "required" => true } }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
  end

  def json = JSON.parse(response.body)

  def booking_field(body = json) = body["form"]["fields"].find { |field| field["type"] == "booking" }

  def add_individual(extra = {})
    post("/api/me/forms/#{form.id}/fields", params: { type: "booking", label: "Pick a time", mode: "individual", availability: availability, services: [lesson] }.merge(extra).compact, headers: auth_headers, as: :json)
  end

  describe "creating it" do
    it "stores the mode, the availability of the teacher and lessons without a schedule" do
      add_individual
      expect(response).to(have_http_status(:created))
      stored = booking_field
      expect(stored).to(include("mode" => "individual", "availability" => { "days" => ["mon", "tue", "wed"], "times" => ["09:00", "10:00"] }))
      expect(stored["services"].first).to(include("name" => "Math", "duration" => 60, "price" => 30.0, "currency" => "EUR", "capacity" => 1))
      expect(stored["services"].first.keys).not_to(include("days", "times", "resource_key"))
    end

    it "takes a teacher who has not set the availability yet, to be finished before publishing" do
      add_individual(availability: nil)
      expect(response).to(have_http_status(:created))
    end

    it "takes lessons with other durations, a monthly offer and a time for each weekday" do
      add_individual(availability: availability.merge(times_by_day: { wed: ["15:00"] }), services: [lesson.merge(extra_durations: [{ duration: 90, price: 40 }], monthly: { price: 100, duration: 45 })])
      expect(response).to(have_http_status(:created))
      expect(booking_field["availability"]["times_by_day"]).to(eq("wed" => ["15:00"]))
    end

    it "keeps a services question exactly as it was, with no mode" do
      post("/api/me/forms/#{form.id}/fields", params: { type: "booking", label: "Pick", services: [{ name: "Cut", duration: 30, days: ["mon"], times: ["09:00"] }] }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:created))
      expect(booking_field.keys).not_to(include("mode", "availability"))
    end
  end

  describe "what it refuses" do
    {
      "a lesson with its own days" => { services: [{ name: "Math", duration: 60, days: ["mon"], times: ["09:00"] }] },
      "a lesson with a category" => { services: [{ name: "Math", duration: 60, category_id: "cat00001" }] },
      "categories" => { categories: [{ id: "cat00001", name: "Sciences" }] },
      "the waiting list" => { rules: { waitlist: true } },
      "an unknown mode" => { mode: "salon" },
      "an unknown weekday" => { availability: { days: ["funday"], times: ["09:00"] } },
      "a repeated weekday" => { availability: { days: ["mon", "mon"], times: ["09:00"] } },
      "a malformed time" => { availability: { days: ["mon"], times: ["9:00"] } },
      "a repeated time" => { availability: { days: ["mon"], times: ["09:00", "09:00"] } },
      "times for a day the teacher does not work" => { availability: { days: ["mon"], times: ["09:00"], times_by_day: { fri: ["10:00"] } } },
      "a lesson of 4 minutes" => { services: [{ name: "Math", duration: 4 }] },
    }.each do |label, change|
      it "rejects #{label}" do
        add_individual(change)
        expect(response).to(have_http_status(:unprocessable_content))
        expect(form.reload.fields).to(eq([]))
      end
    end

    it "rejects an availability on a services question" do
      post("/api/me/forms/#{form.id}/fields", params: { type: "booking", label: "Pick", availability: availability, services: [{ name: "Cut", duration: 30, days: ["mon"], times: ["09:00"] }] }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:unprocessable_content))
    end

    it "rejects a lesson without a name" do
      add_individual(services: [{ name: "", duration: 60 }])
      expect(response).to(have_http_status(:unprocessable_content))
    end
  end

  describe "editing it" do
    before { add_individual }

    def field_id = booking_field["id"]

    it "changes the availability and the lessons" do
      patch("/api/me/forms/#{form.id}/fields/#{field_id}", params: { availability: { days: ["tue"], times: ["14:00"] }, services: [{ id: booking_field["services"].first["id"], name: "Math", duration: 45 }, { name: "Physics", duration: 90 }] }, headers: auth_headers, as: :json)
      expect(response).to(have_http_status(:ok))
      expect(booking_field["availability"]).to(eq("days" => ["tue"], "times" => ["14:00"]))
      expect(booking_field["services"].map { |item| item["name"] }).to(eq(["Math", "Physics"]))
    end

    it "keeps its mode for good" do
      expect { Forms::Definition.update(form.reload, field_id, { "mode" => "services" }) }.to(raise_error(ActiveRecord::RecordInvalid, /mode cannot be changed/))
      expect(form.reload.fields.first["mode"]).to(eq("individual"))
    end
  end

  describe "publishing it" do
    def publish = post("/api/me/forms/#{form.id}/publish", headers: auth_headers, as: :json)

    def complete(**extra)
      add_individual(**extra)
      Forms::Definition.add(form.reload, name)
      Forms::Definition.add(form.reload, email)
    end

    it "publishes a complete one" do
      complete
      publish
      expect(response).to(have_http_status(:ok))
    end

    it "is blocked without a lesson" do
      complete(services: [])
      publish
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["blocks"].pluck("code")).to(include("no_service"))
    end

    it "is blocked until the teacher has a day and a time" do
      complete(availability: { days: ["mon"], times: [] })
      publish
      expect(response).to(have_http_status(:unprocessable_content))
      expect(json["blocks"].pluck("code")).to(eq(["availability_incomplete"]))
    end

    it "is blocked without an availability at all" do
      complete(availability: nil)
      publish
      expect(json["blocks"].pluck("code")).to(eq(["availability_incomplete"]))
    end

    it "still asks for a required email when the code is sent by email" do
      add_individual(rules: { verify_email: true })
      Forms::Definition.add(form.reload, name)
      publish
      expect(json["blocks"].pluck("code")).to(include("no_email"))
    end
  end

  describe "what visitors see" do
    let(:public_form) do
      Forms::Definition.add(form, JSON.parse({ type: "booking", label: "Pick", mode: "individual", availability: availability.merge(times_by_day: { wed: ["15:00"] }), services: [lesson, { name: "Physics", duration: 90 }] }.to_json))
      Forms::Definition.add(form.reload, name)
      Forms::Definition.add(form.reload, email)
      form.reload.tap { |item| Forms::Publish.call(form: item) }
    end

    it "gets every lesson with the days and times of the teacher, and nothing about modes or resources" do
      get("/api/public/forms/#{public_form.public_id}")
      shown = JSON.parse(response.body)["form"]["fields"].find { |field| field["type"] == "booking" }
      expect(shown["services"].map { |item| item.slice("name", "duration", "days", "times") }).to(eq([
        { "name" => "Math", "duration" => 60, "days" => ["mon", "tue", "wed"], "times" => ["09:00", "10:00"] },
        { "name" => "Physics", "duration" => 90, "days" => ["mon", "tue", "wed"], "times" => ["09:00", "10:00"] },
      ]))
      expect(shown["waitlist"]).to(be(false))
      expect(response.body).not_to(include("resource_key", "individual", "availability"))
    end
  end
end
