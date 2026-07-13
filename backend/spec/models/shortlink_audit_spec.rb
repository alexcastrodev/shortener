require "rails_helper"

RSpec.describe("Shortlink audit trail", type: :model) do
  let(:user) { FactoryBot.create(:user) }

  it "audits creation" do
    shortlink = user.shortlinks.create!(original_url: "https://example.com")

    expect(shortlink.audits.count).to(eq(1))
    expect(shortlink.audits.last.action).to(eq("create"))
  end

  it "audits URL changes" do
    shortlink = user.shortlinks.create!(original_url: "https://example.com")
    shortlink.update!(original_url: "https://new-url.com")

    update_audit = shortlink.audits.find_by(action: "update")
    expect(update_audit).to(be_present)
    expect(update_audit.audited_changes).to(include("original_url"))
  end

  it "audits safety flag changes (ban)" do
    shortlink = user.shortlinks.create!(original_url: "https://example.com")
    shortlink.update!(safe: false, safe_checked_at: Time.current)

    update_audit = shortlink.audits.find_by(action: "update")
    expect(update_audit).to(be_present)
    expect(update_audit.audited_changes).to(include("safe"))
  end

  it "does not audit excluded fields" do
    shortlink = user.shortlinks.create!(original_url: "https://example.com")

    create_audit = shortlink.audits.last
    expect(create_audit.audited_changes).not_to(include("short_code", "events_count", "last_accessed_at", "deleted_at"))
  end
end
