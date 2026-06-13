require "rails_helper"

RSpec.describe(PurgeShortlinkJob, type: :job) do
  let(:shortlink) { Shortlink.create!(original_url: "https://example.com") }

  it "deletes the shortlink and all of its events" do
    3.times { Event.create!(shortlink: shortlink, clicked_at: Time.current) }
    shortlink.update!(deleted_at: Time.current)

    described_class.perform_now(shortlink.id)

    expect(Event.where(shortlink_id: shortlink.id)).to(be_empty)
    expect(Shortlink.with_deleted.find_by(id: shortlink.id)).to(be_nil)
  end

  it "deletes events in batches" do
    stub_const("PurgeShortlinkJob::BATCH_SIZE", 2)
    5.times { Event.create!(shortlink: shortlink, clicked_at: Time.current) }
    shortlink.update!(deleted_at: Time.current)

    described_class.perform_now(shortlink.id)

    expect(Event.where(shortlink_id: shortlink.id)).to(be_empty)
  end

  it "does nothing when the shortlink was not soft-deleted" do
    described_class.perform_now(shortlink.id)

    expect(Shortlink.with_deleted.find_by(id: shortlink.id)).to(eq(shortlink))
  end

  it "is a no-op when the shortlink no longer exists" do
    expect { described_class.perform_now(-1) }.not_to(raise_error)
  end
end
