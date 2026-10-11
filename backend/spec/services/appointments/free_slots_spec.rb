require "rails_helper"

RSpec.describe(Appointments::FreeSlots) do
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Booking") }
  let(:now) { Time.utc(2026, 11, 1) }
  let(:monday) { Date.new(2026, 11, 2) }
  let(:days) { ["mon", "tue", "wed", "thu", "fri"] }
  let(:math) { { "id" => "math", "resource_key" => "main", "duration" => 60, "capacity" => 1, "days" => days, "times" => ["09:00", "10:00", "11:00", "12:00"] } }
  let(:physics) { { "id" => "physics", "resource_key" => "main", "duration" => 90, "capacity" => 1, "days" => days, "times" => ["09:00", "10:00", "11:00", "12:00"] } }
  let(:alone) { { "id" => "alone", "duration" => 60, "capacity" => 1, "days" => days, "times" => ["09:00", "10:00", "11:00", "12:00"] } }
  let(:booking) { { "services" => [math, physics, alone], "rules" => { "time_zone" => "UTC", "window_days" => 30 }, "exceptions" => [] } }

  def free(service) = described_class.call(form: form, booking: booking, service: service, from: monday, to: monday, now: now).map { |slot| [slot[:time], slot[:durations]] }

  def book(service, time, minutes: nil)
    at = Time.utc(2026, 11, 2, *time.split(":").map(&:to_i))
    Appointments::Reserve.call(form: form, service_key: service["id"], resource_key: Appointments::Resource.key(service), capacity: 1, times: [at], durations: { at.to_i => minutes || service["duration"] })
  end

  it "offers everything on a free day" do
    expect(free(math).map(&:first)).to(eq(["09:00", "10:00", "11:00", "12:00"]))
  end

  it "takes the hour and the time it covers from the other service of the resource" do
    book(math, "10:00")
    expect(free(physics)).to(eq([["11:00", [90]], ["12:00", [90]]]))
  end

  it "uses the main duration of the other service when the row has none" do
    book(physics, "09:00")
    AppointmentSlot.update_all(duration: nil)
    expect(free(math).map(&:first)).to(eq(["11:00", "12:00"]))
  end

  it "leaves a service of another resource alone" do
    book(math, "10:00")
    expect(free(alone).map(&:first)).to(eq(["09:00", "10:00", "11:00", "12:00"]))
  end

  it "frees the hour again when the booking is released" do
    book(math, "10:00")
    AppointmentSlot.update_all(booked: 0)
    expect(free(physics).map(&:first)).to(eq(["09:00", "10:00", "11:00", "12:00"]))
  end

  it "sees a row an older instance created without a resource key" do
    at = Time.utc(2026, 11, 2, 10)
    AppointmentSlot.insert_all([{ form_id: form.id, service_key: "alone", starts_at: at, capacity: 1, booked: 1 }])
    expect(free(alone).map(&:first)).to(eq(["09:00", "11:00", "12:00"]))
  end
end
