require "rails_helper"

RSpec.describe("/api/me/forms/:id/appointments", type: :request) do
  include_context "authenticated user"

  let(:other) { FactoryBot.create(:user) }
  let(:form) { Form.create!(user: current_user, title: "Salon") }

  before do
    host! "localhost"
    allow(ENV).to(receive(:[]).and_call_original)
    allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return("true"))
  end

  def json
    JSON.parse(response.body)
  end

  def book(name:, email: "#{name.downcase.gsub(/\W/, "")}@example.com", at: Time.utc(2026, 11, 3, 9), status: "confirmed", target: form, reason: nil)
    slot = AppointmentSlot.find_or_create_by!(form: target, service_key: "svc00001", starts_at: at)
    Appointment.create!(
      form: target,
      response: FormResponse.create!(form: target, answers: {}),
      slot: slot,
      group_key: SecureRandom.uuid,
      status: status,
      client_name: name,
      client_email: email,
      cancel_reason: reason,
      snapshot: { "name" => "Haircut" },
    )
  end

  def list(params = {}, target: form)
    get("/api/me/forms/#{target.id}/appointments", params: params, headers: auth_headers)
  end

  def names
    json["appointments"].map { |row| row["client_name"] }
  end

  describe "access" do
    it "answers 401 without a token on both routes, and 404 when the feature is off" do
      ["appointments", "appointments_export"].each do |path|
        get("/api/me/forms/#{form.id}/#{path}")
        expect(response).to(have_http_status(:unauthorized), path)
      end
      allow(ENV).to(receive(:[]).with("APPOINTMENTS_ENABLED").and_return(nil))
      list
      expect(response).to(have_http_status(:not_found))
    end

    it "answers 404 for someone else's form on both routes" do
      theirs = Form.create!(user: other, title: "Theirs")
      book(name: "Secret", target: theirs)
      list({}, target: theirs)
      expect(response).to(have_http_status(:not_found))
      get("/api/me/forms/#{theirs.id}/appointments_export", headers: auth_headers)
      expect(response).to(have_http_status(:not_found))
      expect(response.body).not_to(include("Secret"))
    end
  end

  describe "listing" do
    it "lists the form's appointments, newest first, with the fields the owner needs" do
      first = book(name: "Ana")
      second = book(name: "Bo", status: "cancelled", reason: "Sick")
      list
      expect(response).to(have_http_status(:ok))
      expect(json["appointments"].map { |row| row["id"] }).to(eq([second.id, first.id]))
      expect(json["appointments"].first).to(eq(
        "id" => second.id,
        "status" => "cancelled",
        "starts_at" => "2026-11-03T09:00:00Z",
        "service_name" => "Haircut",
        "client_name" => "Bo",
        "client_email" => "bo@example.com",
        "group_key" => second.group_key,
        "cancel_reason" => "Sick",
        "created_at" => second.created_at.utc.iso8601,
      ))
    end

    it "does not mix in other forms of mine or other users' forms" do
      book(name: "Mine")
      book(name: "Elsewhere", target: Form.create!(user: current_user, title: "Other form"))
      book(name: "Theirs", target: Form.create!(user: other, title: "Theirs"))
      list
      expect(names).to(eq(["Mine"]))
    end

    it "filters by status and ignores an unknown status" do
      book(name: "Ana")
      book(name: "Bo", status: "pending")
      list({ status: "pending" })
      expect(names).to(eq(["Bo"]))
      list({ status: "nonsense" })
      expect(names).to(match_array(["Ana", "Bo"]))
    end

    it "searches name and email, treating wildcards literally" do
      book(name: "Ana Silva", email: "ana@example.com")
      book(name: "Bo", email: "bo@corp.test")
      list({ q: "silva" })
      expect(names).to(eq(["Ana Silva"]))
      list({ q: "CORP.test" })
      expect(names).to(eq(["Bo"]))
      list({ q: "%" })
      expect(names).to(eq([]))
      list({ q: "_o" })
      expect(names).to(eq([]))
    end

    it "filters by date range in the owner's time zone" do
      current_user.update!(time_zone: "Pacific/Auckland")
      book(name: "Early", at: Time.utc(2026, 11, 2, 20))
      book(name: "Late", at: Time.utc(2026, 11, 3, 20))
      list({ from: "2026-11-03", to: "2026-11-03" })
      expect(names).to(eq(["Early"]))
    end

    it "answers 422 for a malformed date" do
      list({ from: "tomorrow" })
      expect(response).to(have_http_status(:unprocessable_entity))
    end

    it "pages with a cursor" do
      ids = Array.new(52) { |index| book(name: "N#{index}", at: Time.utc(2026, 11, 3, 9) + index.hours).id }
      list
      expect(json["appointments"].size).to(eq(50))
      expect(json["next_before"]).to(eq(ids[2]))
      list({ before: json["next_before"] })
      expect(json["appointments"].map { |row| row["id"] }).to(eq([ids[1], ids[0]]))
      expect(json["next_before"]).to(be_nil)
    end
  end

  describe "export" do
    def export(params = {})
      get("/api/me/forms/#{form.id}/appointments_export", params: params, headers: auth_headers)
    end

    it "downloads a CSV of the filtered rows, oldest first, uncached" do
      book(name: "Later", at: Time.utc(2026, 11, 4, 9))
      book(name: "Earlier", at: Time.utc(2026, 11, 3, 9))
      book(name: "Hidden", status: "pending")
      export({ status: "confirmed" })

      expect(response).to(have_http_status(:ok))
      expect(response.media_type).to(eq("text/csv"))
      expect(response.headers["Content-Disposition"]).to(include("salon-appointments.csv"))
      expect(response.headers["Cache-Control"]).to(include("no-store"))
      lines = response.body.delete_prefix("﻿").split("\r\n")
      expect(lines.first).to(eq('"Starts at","Service","Name","Email","Status","Booked at","Reason"'))
      expect(lines.drop(1).map { |line| line.split(",")[2] }).to(eq(['"Earlier"', '"Later"']))
    end

    it "V05: neutralises spreadsheet formulas and escapes quotes" do
      ["=HYPERLINK(\"http://evil\")", "+1+1", "-2", "@SUM(A1)", "\tcmd", "\rcmd"].each_with_index do |name, index|
        book(name: name, email: "x#{index}@example.com", at: Time.utc(2026, 11, 3, 9) + index.hours)
      end
      book(name: 'Say "hi", ok', email: "q@example.com", at: Time.utc(2026, 11, 4, 9))
      export
      body = response.body
      expect(body).to(include("\"'=HYPERLINK(\"\"http://evil\"\")\"", "\"'+1+1\"", "\"'-2\"", "\"'@SUM(A1)\"", "\"'\tcmd\"", "\"'\rcmd\""))
      expect(body).to(include('"Say ""hi"", ok"'))
      expect(body).not_to(match(/(\A|,|\n)"[=+\-@]/))
    end

    it "V05: downloads an Excel file with every cell stored as text" do
      book(name: "=1+1")
      export({ format_type: "xlsx" })
      expect(response).to(have_http_status(:ok))
      expect(response.media_type).to(eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
      sheet = Zip::File.open_buffer(StringIO.new(response.body)).read("xl/worksheets/sheet1.xml")
      expect(sheet).to(include("=1+1"))
      expect(sheet).not_to(include("<f>"))
    end

    it "refuses a malformed date" do
      export({ to: "x" })
      expect(response).to(have_http_status(:unprocessable_entity))
    end
  end
end
