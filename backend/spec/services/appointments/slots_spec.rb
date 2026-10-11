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

  it "V16: skips a local time that does not exist on the day clocks go forward, and keeps the one that repeats on the day they go back" do
    spring = slots(zone: "Europe/Lisbon", from: Date.new(2026, 3, 29), to: Date.new(2026, 3, 29), now: Time.utc(2026, 3, 1))
    expect(spring.map { |slot| slot[:time] }).to(eq(["09:00", "23:30"]))

    fall = slots(zone: "Europe/Lisbon", from: Date.new(2026, 10, 25), to: Date.new(2026, 10, 25), now: Time.utc(2026, 10, 1))
    expect(fall.map { |slot| slot[:time] }).to(eq(["01:30", "09:00", "23:30"]))
  end

  it "V16: keeps the same wall-clock time across daylight saving" do
    result = slots(zone: "Europe/Lisbon", from: Date.new(2026, 3, 28), to: Date.new(2026, 3, 30), now: Time.utc(2026, 3, 1))
    nine = result.select { |slot| slot[:time] == "09:00" }.map { |slot| slot[:starts_at].utc.hour }
    expect(nine).to(eq([9, 8, 8]))
  end

  it "uses the owner's calendar day, not UTC's, for the weekday" do
    service["days"] = ["mon"]
    result = slots(zone: "Pacific/Auckland", from: Date.new(2026, 11, 2), to: Date.new(2026, 11, 2), now: Time.utc(2026, 10, 1))
    expect(result.map { |slot| slot[:starts_at].utc.iso8601 }).to(include("2026-11-01T20:00:00Z"))
  end

  describe "several durations" do
    let(:service) { { "id" => "cut", "duration" => 60, "price" => 40, "currency" => "EUR", "extra_durations" => [{ "duration" => 90, "price" => 55 }], "capacity" => 1, "days" => ["mon"], "times" => ["09:00", "10:00", "11:00", "14:00"] } }
    let(:monday) { Date.new(2026, 11, 2) }
    let(:now) { Time.utc(2026, 11, 1) }

    def day(**options) = slots(from: monday, to: monday, now: now, **options)

    def at(time) = Time.utc(2026, 11, 2, *time.split(":").map(&:to_i))

    it "offers every duration on a free day" do
      expect(day.map { |slot| [slot[:time], slot[:durations]] }).to(eq([["09:00", [60, 90]], ["10:00", [60, 90]], ["11:00", [60, 90]], ["14:00", [60, 90]]]))
    end

    it "drops the durations that run into a full neighbour and keeps the ones that fit" do
      result = day(booked: { at("11:00").to_i => 1 }, lengths: { at("11:00").to_i => 60 })
      expect(result.map { |slot| [slot[:time], slot[:durations]] }).to(eq([["09:00", [60, 90]], ["10:00", [60]], ["14:00", [60, 90]]]))
    end

    it "blocks the times a long booking covers" do
      result = day(booked: { at("09:00").to_i => 1 }, lengths: { at("09:00").to_i => 90 })
      expect(result.map { |slot| slot[:time] }).to(eq(["11:00", "14:00"]))
    end

    it "treats a booking with no stored duration as the main one" do
      result = day(booked: { at("09:00").to_i => 1 })
      expect(result.map { |slot| [slot[:time], slot[:durations]] }).to(eq([["10:00", [60, 90]], ["11:00", [60, 90]], ["14:00", [60, 90]]]))
    end

    it "adds the buffer on both sides of a booking" do
      result = day(rules: { "buffer_minutes" => 60 }, booked: { at("11:00").to_i => 1 }, lengths: { at("11:00").to_i => 60 })
      expect(result.map { |slot| [slot[:time], slot[:durations]] }).to(eq([["09:00", [60]], ["14:00", [60, 90]]]))
    end

    it "offers a partly booked time only with the duration it was booked with" do
      service["capacity"] = 2
      result = day(booked: { at("09:00").to_i => 1 }, lengths: { at("09:00").to_i => 90 })
      expect(result.first).to(include(time: "09:00", durations: [90]))
    end

    it "narrows the offer to the wanted durations" do
      expect(day(only: [90]).map { |slot| slot[:durations] }.uniq).to(eq([[90]]))
    end
  end

  describe "time taken by another service of the same resource" do
    let(:service) { { "id" => "physics", "duration" => 60, "extra_durations" => [{ "duration" => 90, "price" => 5 }], "capacity" => 1, "days" => ["mon"], "times" => ["09:00", "10:00", "11:00", "12:00"] } }
    let(:monday) { Date.new(2026, 11, 2) }
    let(:now) { Time.utc(2026, 11, 1) }

    def day(occupied:, **options) = slots(from: monday, to: monday, now: now, occupied: occupied, **options)

    def at(time) = Time.utc(2026, 11, 2, *time.split(":").map(&:to_i))

    it "removes the hour itself" do
      result = day(occupied: [{ starts_at: at("10:00"), minutes: 60 }])
      expect(result.map { |slot| slot[:time] }).to(eq(["09:00", "11:00", "12:00"]))
    end

    it "keeps only the durations that end before it starts and start after it ends" do
      result = day(occupied: [{ starts_at: at("11:00"), minutes: 60 }])
      expect(result.map { |slot| [slot[:time], slot[:durations]] }).to(eq([["09:00", [60, 90]], ["10:00", [60]], ["12:00", [60, 90]]]))
    end

    it "blocks the start that falls inside a long booking" do
      result = day(occupied: [{ starts_at: at("09:00"), minutes: 90 }])
      expect(result.map { |slot| slot[:time] }).to(eq(["11:00", "12:00"]))
    end

    it "adds the buffer around it" do
      result = day(rules: { "buffer_minutes" => 60 }, occupied: [{ starts_at: at("11:00"), minutes: 60 }])
      expect(result.map { |slot| [slot[:time], slot[:durations]] }).to(eq([["09:00", [60]]]))
    end

    it "changes nothing when nothing is taken" do
      expect(day(occupied: []).map { |slot| slot[:time] }).to(eq(["09:00", "10:00", "11:00", "12:00"]))
    end
  end

  describe "a teacher's lessons" do
    let(:service) { { "id" => "math", "resource_key" => "main", "duration" => 60, "capacity" => 2, "days" => ["mon"], "times" => ["09:00", "10:00", "10:30", "11:00"] } }
    let(:monday) { Date.new(2026, 11, 2) }
    let(:now) { Time.utc(2026, 11, 1) }

    def at(time) = Time.utc(2026, 11, 2, *time.split(":").map(&:to_i))

    def day(booked:, **options) = slots(from: monday, to: monday, now: now, booked: booked, lengths: booked.keys.to_h { |key| [key, 60] }, **options)

    it "stops offering what overlaps a class that still has room, but keeps the class itself" do
      result = day(booked: { at("10:00").to_i => 1 })
      expect(result.map { |slot| slot[:time] }).to(eq(["09:00", "10:00", "11:00"]))
    end

    it "does the same for a service that is its own resource only when it is full" do
      alone = service.except("resource_key")
      result = described_class.call(service: alone, rules: { "time_zone" => "UTC" }, from: monday, to: monday, now: now, booked: { at("10:00").to_i => 1 }, lengths: { at("10:00").to_i => 60 })
      expect(result.map { |slot| slot[:time] }).to(eq(["09:00", "10:00", "10:30", "11:00"]))
    end

    it "uses the length of the booking and the buffer" do
      result = day(booked: { at("10:00").to_i => 1 }, rules: { "buffer_minutes" => 30 })
      expect(result.map { |slot| slot[:time] }).to(eq(["10:00"]))
    end
  end
end
