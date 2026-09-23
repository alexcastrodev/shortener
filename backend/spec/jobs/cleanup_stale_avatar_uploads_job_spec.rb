require "rails_helper"

RSpec.describe(CleanupStaleAvatarUploadsJob, type: :job) do
  def attach_upload(page)
    page.avatar_upload.attach(io: File.open(Rails.root.join("spec/fixtures/files/avatar.png")), filename: "avatar-upload", content_type: "image/png")
  end

  it "drops uploads stuck for over an hour and keeps recent ones" do
    stale = FactoryBot.create(:page)
    fresh = FactoryBot.create(:page)
    attach_upload(stale)
    stale.avatar_upload.attachment.update_column(:created_at, 2.hours.ago)
    attach_upload(fresh)

    described_class.perform_now

    expect(stale.reload.avatar_upload).not_to(be_attached)
    expect(fresh.reload.avatar_upload).to(be_attached)
  end
end
