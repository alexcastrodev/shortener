require "rails_helper"

RSpec.describe(PurgeOldIpAddressesJob) do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { FactoryBot.create(:user) }
  let(:link) { user.shortlinks.create!(original_url: "https://example.com") }
  let(:page) { Page.create!(user: user, slug: "ip-page") }
  let(:page_link) { page.page_links.create!(label: "L", url: "https://example.com", kind: "link", position: 0) }

  it "clears IP addresses older than 90 days and keeps everything else, including recent IPs" do
    old_event = Event.create!(shortlink: link, ip_address: "198.51.100.1", country_code: "PT", clicked_at: 91.days.ago)
    new_event = Event.create!(shortlink: link, ip_address: "198.51.100.2", clicked_at: 89.days.ago)
    old_click = PageLinkClick.create!(page_link: page_link, ip_address: "198.51.100.3", country_code: "PT", clicked_at: 120.days.ago)
    new_click = PageLinkClick.create!(page_link: page_link, ip_address: "198.51.100.4", clicked_at: 1.day.ago)
    old_audit = Audited::Audit.create!(auditable: link, action: "update", remote_address: "198.51.100.5", created_at: 100.days.ago, audited_changes: {})
    new_audit = Audited::Audit.create!(auditable: link, action: "update", remote_address: "198.51.100.6", audited_changes: {})

    described_class.perform_now

    expect(old_event.reload.ip_address).to(be_nil)
    expect(old_event.country_code).to(eq("PT"))
    expect(old_event.shortlink_id).to(eq(link.id))
    expect(old_click.reload.ip_address).to(be_nil)
    expect(old_audit.reload.remote_address).to(be_nil)
    expect(new_event.reload.ip_address).to(eq("198.51.100.2"))
    expect(new_click.reload.ip_address).to(eq("198.51.100.4"))
    expect(new_audit.reload.remote_address).to(eq("198.51.100.6"))
  end

  it "works in batches and is idempotent" do
    stub_const("PurgeOldIpAddressesJob::BATCH", 2)
    5.times { |i| Event.create!(shortlink: link, ip_address: "198.51.100.#{i + 10}", clicked_at: 200.days.ago) }

    described_class.perform_now
    described_class.perform_now

    expect(Event.where.not(ip_address: nil).count).to(eq(0))
    expect(Event.count).to(eq(5))
  end

  it "clears addresses once they cross the 90 day line" do
    event = Event.create!(shortlink: link, ip_address: "198.51.100.20", clicked_at: Time.current)

    travel_to(89.days.from_now) { described_class.perform_now }
    expect(event.reload.ip_address).to(be_present)

    travel_to(91.days.from_now) { described_class.perform_now }
    expect(event.reload.ip_address).to(be_nil)
  end
end
