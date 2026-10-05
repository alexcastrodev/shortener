require "rails_helper"

RSpec.describe(Appointments::Reserve) do
  let(:form) { Form.create!(user: FactoryBot.create(:user), title: "Booking") }
  let(:day) { Time.utc(2026, 11, 2, 9) }

  def reserve(times, capacity: 1)
    described_class.call(form: form, service_key: "cut", capacity: capacity, times: times)
  end

  def booked(time)
    AppointmentSlot.find_by(form_id: form.id, service_key: "cut", starts_at: time)&.booked
  end

  def concurrently(count)
    Array.new(count) do |index|
      Thread.new { ActiveRecord::Base.connection_pool.with_connection { yield(index) } }
    end.map(&:value)
  end

  it "creates the slot and counts the booking" do
    reserve([day])
    expect(booked(day)).to(eq(1))
  end

  it "stops at capacity and leaves the counter alone" do
    reserve([day], capacity: 2)
    reserve([day], capacity: 2)
    expect { reserve([day], capacity: 2) }.to(raise_error(described_class::Full) { |error| expect(error.starts_at).to(eq(day)) })
    expect(booked(day)).to(eq(2))
  end

  it "has no ceiling when capacity is unlimited" do
    5.times { reserve([day], capacity: nil) }
    expect(booked(day)).to(eq(5))
  end

  it "refuses when the capacity was lowered below what is already booked" do
    reserve([day], capacity: 3)
    reserve([day], capacity: 3)
    expect { reserve([day], capacity: 1) }.to(raise_error(described_class::Full))
    expect(booked(day)).to(eq(2))
  end

  it "is all or nothing across several days" do
    reserve([day + 1.day])
    expect { reserve([day, day + 1.day, day + 2.days]) }.to(raise_error(described_class::Full))
    expect(booked(day)).to(be_nil)
    expect(booked(day + 1.day)).to(eq(1))
    expect(booked(day + 2.days)).to(be_nil)
  end

  it "books each day of a multi-day request once, in time order" do
    ids = reserve([day + 2.days, day, day + 1.day, day])
    expect(ids.size).to(eq(3))
    expect(AppointmentSlot.where(id: ids).order(:starts_at).pluck(:starts_at)).to(eq([day, day + 1.day, day + 2.days]))
  end

  it "confirms exactly one of 50 simultaneous requests for the last place" do
    results = concurrently(50) do
      reserve([day])
      :booked
    rescue described_class::Full
      :full
    end

    expect(results.tally).to(eq(booked: 1, full: 49))
    expect(booked(day)).to(eq(1))
  end

  it "never overbooks and never deadlocks when crossing multi-day requests arrive together" do
    days = [day, day + 1.day, day + 2.days]
    results = concurrently(20) do |index|
      reserve(days.rotate(index % 3).reverse, capacity: 4)
      :booked
    rescue described_class::Full
      :full
    end

    expect(results.tally.keys - [:booked, :full]).to(be_empty)
    expect(results.count(:booked)).to(eq(4))
    expect(days.map { |time| booked(time) }).to(eq([4, 4, 4]))
  end

  describe "releasing" do
    it "gives the places back" do
      ids = reserve([day, day + 1.day], capacity: 2)
      Appointments::Release.call(ids)
      expect([booked(day), booked(day + 1.day)]).to(eq([0, 0]))
    end

    it "never goes below zero, even when released twice" do
      ids = reserve([day])
      2.times { Appointments::Release.call(ids) }
      expect(booked(day)).to(eq(0))
    end

    it "lets the freed place be booked again" do
      ids = reserve([day])
      expect { reserve([day]) }.to(raise_error(described_class::Full))
      Appointments::Release.call(ids)
      expect { reserve([day]) }.not_to(raise_error)
    end
  end
end
