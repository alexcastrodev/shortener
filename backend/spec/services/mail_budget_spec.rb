require "rails_helper"

RSpec.describe(MailBudget) do
  include ActiveSupport::Testing::TimeHelpers

  around do |example|
    skip("requires REDIS_URL") if ENV["REDIS_URL"].blank?
    previous = ENV.to_h.slice("MAIL_DAILY_LIMIT", "MAIL_MONTHLY_LIMIT", "MAIL_NEW_ADDRESS_DAILY_LIMIT")
    ENV.update("MAIL_DAILY_LIMIT" => "5", "MAIL_MONTHLY_LIMIT" => "8", "MAIL_NEW_ADDRESS_DAILY_LIMIT" => "2")
    example.run
  ensure
    ENV.delete("MAIL_DAILY_LIMIT")
    ENV.delete("MAIL_MONTHLY_LIMIT")
    ENV.delete("MAIL_NEW_ADDRESS_DAILY_LIMIT")
    ENV.update(previous) if previous
  end

  before do
    allow(Sentry).to(receive(:capture_message))
  end

  it "keeps the rest of the day for existing accounts once new addresses use their share" do
    2.times { expect(described_class.reserve(new_address: true)).to(be_ok) }

    refused = described_class.reserve(new_address: true)
    expect(refused).not_to(be_ok)
    expect(refused.reason).to(eq(:new_address_limit))

    3.times { expect(described_class.reserve(new_address: false)).to(be_ok) }
    expect(described_class.reserve(new_address: false).reason).to(eq(:daily_limit))
    expect(described_class.usage).to(include(day: 5, new_addresses: 2))
  end

  it "gives back what a refused reservation took" do
    2.times { described_class.reserve(new_address: true) }
    3.times { described_class.reserve(new_address: true) }

    expect(described_class.usage).to(include(day: 2, month: 2, new_addresses: 2))
  end

  it "respects the monthly limit across days" do
    travel_to(Time.utc(2026, 9, 1, 12)) { 5.times { described_class.reserve(new_address: false) } }
    travel_to(Time.utc(2026, 9, 2, 12)) do
      3.times { expect(described_class.reserve(new_address: false)).to(be_ok) }
      expect(described_class.reserve(new_address: false).reason).to(eq(:monthly_limit))
    end
  end

  it "alerts once per reason per day" do
    2.times { described_class.reserve(new_address: true) }
    3.times { described_class.reserve(new_address: true) }

    expect(Sentry).to(have_received(:capture_message).once)
  end
end
