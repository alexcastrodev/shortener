require "rails_helper"

RSpec.describe(Booking::Modes) do
  let(:services_field) { { "type" => "booking", "services" => [{ "id" => "svc00001", "name" => "Cut", "duration" => 30, "days" => ["mon"], "times" => ["09:00"] }] } }
  let(:individual_field) do
    {
      "type" => "booking",
      "mode" => "individual",
      "availability" => { "days" => ["mon", "wed"], "times" => ["09:00", "10:00"], "times_by_day" => { "wed" => ["15:00"] } },
      "services" => [{ "id" => "math0001", "name" => "Math", "duration" => 60 }, { "id" => "phys0001", "name" => "Physics", "duration" => 90, "price" => 40, "currency" => "EUR" }],
    }
  end

  it "knows the services mode, which is the one a field without a mode has, and the individual mode" do
    expect(described_class.fetch(nil)).to(eq(Booking::Modes::Services))
    expect(described_class.fetch("services")).to(eq(Booking::Modes::Services))
    expect(described_class.fetch("individual")).to(eq(Booking::Modes::Individual))
    expect(described_class.fetch("salon")).to(be_nil)
    expect(described_class::NAMES).to(eq(["services", "individual"]))
  end

  it "leaves a services field and any other field exactly as it is" do
    expect(described_class.compile(services_field)).to(equal(services_field))
    other = { "type" => "short_text", "label" => "Name" }
    expect(described_class.compile(other)).to(equal(other))
  end

  it "gives every lesson of an individual field the one availability of the teacher and the same resource" do
    compiled = described_class.compile(individual_field)
    schedules = compiled["services"].map { |service| service.slice("days", "times", "times_by_day") }
    expect(schedules).to(eq([individual_field["availability"]] * 2))
    expect(compiled["services"].map { |service| Appointments::Resource.key(service) }).to(eq(["main", "main"]))
    expect(compiled["services"].last).to(include("name" => "Physics", "duration" => 90, "price" => 40))
  end

  it "keeps the own schedule of a lesson, shares the resource and leaves the other lessons on the availability of the teacher" do
    own = { "days" => ["tue"], "times" => ["14:00"], "times_by_day" => { "tue" => ["15:00"] } }
    field = individual_field.merge("services" => [individual_field["services"].first, individual_field["services"].last.merge(own)])
    first, last = described_class.compile(field)["services"]
    expect(first.slice("days", "times", "times_by_day")).to(eq(individual_field["availability"]))
    expect(last.slice("days", "times", "times_by_day")).to(eq(own))
    expect([first, last].map { |service| Appointments::Resource.key(service) }).to(eq(["main", "main"]))
  end

  it "does not change the field it is given" do
    original = Marshal.load(Marshal.dump(individual_field))
    described_class.compile(individual_field)
    expect(individual_field).to(eq(original))
  end

  it "compiles an individual field that has no availability yet into lessons with no schedule" do
    compiled = described_class.compile(individual_field.except("availability"))
    expect(compiled["services"].first).to(include("resource_key" => "main"))
    expect(compiled["services"].first["days"]).to(be_nil)
  end

  it "keeps the code of one mode away from the other" do
    root = Rails.root.join("app/services/booking/modes")
    expect(root.join("services.rb").read).not_to(match(/individual/i))
    expect(root.join("individual.rb").read).not_to(match(/Modes::Services|services_errors|services_publish_blocks/))
  end
end
