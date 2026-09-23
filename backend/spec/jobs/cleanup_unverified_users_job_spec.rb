require "rails_helper"

RSpec.describe(CleanupUnverifiedUsersJob) do
  it "removes accounts that never confirmed a code after a day, and nothing else" do
    stale = User.create!(email: "stale@example.com", created_at: 2.days.ago)
    fresh = User.create!(email: "fresh@example.com", created_at: 1.hour.ago)
    verified = User.create!(email: "verified@example.com", created_at: 1.year.ago, verified_at: 1.year.ago)

    described_class.perform_now

    expect(User.exists?(stale.id)).to(be(false))
    expect(User.where(id: [fresh.id, verified.id]).count).to(eq(2))
  end
end
