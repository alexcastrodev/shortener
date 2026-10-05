require "rails_helper"

RSpec.describe(Appointments::Slots) do
  let(:service) { { "duration" => 60, "capacity" => nil, "days" => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], "times" => ["01:30", "09:00", "23:30"] } }

  def slots(zone: "UTC", from:, to:, now:, rules: {}, **options)
    described_class.call(service: service, rules: { "time_zone" => zone }.merge(rules), from: from, to: to, now: now, **options)
  end

  it "never returns a time before now, whatever the zone, notice or hour" do
    zones = ["UTC", "Europe/Lisbon", "America/Sao_Paulo", "Asia/Kolkata", "Pacific/Auckland", "America/St_Johns"]
    200.times do |index|
      now = Time.utc(2026, 1, 1) + (index * 7919).minutes
      zone = zones[index % zones.size]
      rules = { "min_notice_minutes" => (index % 4) * 45 }
      result = slots(zone: zone, from: now.to_date - 1, to: now.to_date + 3, now: now, rules: rules)
      expect(result.map { |slot| slot[:starts_at] }).to(all(be >= now + rules["min_notice_minutes"].minutes))
    end
  end

  it "returns times in order and never more than 62 days" do
    result = slots(from: Date.new(2026, 11, 2), to: Date.new(2027, 6, 1), now: Time.utc(2026, 11, 1), rules: { "window_days" => 365 })
    expect(result.map { |slot| slot[:starts_at] }).to(eq(result.map { |slot| slot[:starts_at] }.sort))
    expect(result.map { |slot| slot[:date] }.uniq.size).to(eq(62))
  end

  it "skips a local time that does not exist on the day clocks go forward, and keeps the one that repeats on the day they go back" do
    spring = slots(zone: "Europe/Lisbon", from: Date.new(2026, 3, 29), to: Date.new(2026, 3, 29), now: Time.utc(2026, 3, 1))
    expect(spring.map { |slot| slot[:time] }).to(eq(["09:00", "23:30"]))

    fall = slots(zone: "Europe/Lisbon", from: Date.new(2026, 10, 25), to: Date.new(2026, 10, 25), now: Time.utc(2026, 10, 1))
    expect(fall.map { |slot| slot[:time] }).to(eq(["01:30", "09:00", "23:30"]))
  end

  it "keeps the same wall-clock time across daylight saving" do
    result = slots(zone: "Europe/Lisbon", from: Date.new(2026, 3, 28), to: Date.new(2026, 3, 30), now: Time.utc(2026, 3, 1))
    nine = result.select { |slot| slot[:time] == "09:00" }.map { |slot| slot[:starts_at].utc.hour }
    expect(nine).to(eq([9, 8, 8]))
  end

  it "uses the owner's calendar day, not UTC's, for the weekday" do
    service["days"] = ["mon"]
    result = slots(zone: "Pacific/Auckland", from: Date.new(2026, 11, 2), to: Date.new(2026, 11, 2), now: Time.utc(2026, 10, 1))
    expect(result.map { |slot| slot[:starts_at].utc.iso8601 }).to(include("2026-11-01T20:00:00Z"))
  end
end
