require "rails_helper"

RSpec.describe(ExpireScheduledShortlinksJob, type: :job) do
  it "deactivates only links past their expiration date" do
    expired = FactoryBot.create(:shortlink)
    expired.update_columns(expires_at: 1.minute.ago)
    upcoming = FactoryBot.create(:shortlink, expires_at: 1.day.from_now)
    forever = FactoryBot.create(:shortlink)

    described_class.perform_now

    expect(expired.reload.inactive_at).to(be_present)
    expect(upcoming.reload.inactive_at).to(be_nil)
    expect(forever.reload.inactive_at).to(be_nil)
  end

  it "removes the edge cache entry of each expired link" do
    expired = FactoryBot.create(:shortlink)
    expired.update_columns(expires_at: 1.minute.ago)
    allow(Shortlink).to(receive(:expired).and_return(Shortlink.where(id: expired.id)))
    expect_any_instance_of(Shortlink).to(receive(:remove_cache))

    described_class.perform_now
  end
end
