require "rails_helper"

RSpec.describe(Shortlink, "user shortlinks_count") do
  let(:user) { FactoryBot.create(:user) }
  let!(:kept) { FactoryBot.create(:shortlink, user: user) }
  let!(:deleted) { FactoryBot.create(:shortlink, user: user) }

  def count = user.reload.shortlinks_count

  it "counts every created link" do
    expect(count).to(eq(2))
  end

  it "drops a link when it is soft-deleted and does not drop it again when it is purged" do
    deleted.soft_delete!
    expect(count).to(eq(1))

    PurgeShortlinkJob.perform_now(deleted.id)
    expect(count).to(eq(1))
    expect(count).to(eq(user.shortlinks.count))
  end

  it "drops a visible link on destroy and leaves the count alone when a soft-deleted one is destroyed" do
    deleted.soft_delete!

    Shortlink.with_deleted.find(deleted.id).destroy!
    expect(count).to(eq(1))

    kept.destroy!
    expect(count).to(eq(0))
  end

  it "counts a link again when it is restored" do
    deleted.soft_delete!

    Shortlink.with_deleted.find(deleted.id).update!(deleted_at: nil)
    expect(count).to(eq(2))
  end

  it "does not change the count on other updates of a soft-deleted link" do
    deleted.soft_delete!

    Shortlink.with_deleted.find(deleted.id).update!(title: "renamed")
    expect(count).to(eq(1))
  end
end
