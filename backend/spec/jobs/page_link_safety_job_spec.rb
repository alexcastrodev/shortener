require "rails_helper"

RSpec.describe(PageLinkSafetyJob, type: :job) do
  let(:page) { FactoryBot.create(:page) }
  let!(:good) { FactoryBot.create(:page_link, page: page, url: "https://example.com") }
  let!(:bad) { FactoryBot.create(:page_link, page: page, url: "https://malware.example.com") }

  it "hides flagged links and marks the rest as checked" do
    allow(GoogleLib::SafeBrowsing::V4::Services).to(receive(:unsafe_urls).and_return(Set["https://malware.example.com"]))

    described_class.perform_now([good.id, bad.id])

    expect(bad.reload).to(have_attributes(safe: false))
    expect(good.reload).to(have_attributes(safe: true))
    expect([good.safe_checked_at, bad.safe_checked_at]).to(all(be_present))
    expect(page.page_links.visible).to(eq([good]))
  end

  it "leaves links untouched when Safe Browsing fails" do
    allow(GoogleLib::SafeBrowsing::V4::Services).to(receive(:unsafe_urls).and_raise(GoogleLib::SafeBrowsing::V4::Services::Error))

    described_class.perform_now([good.id, bad.id])

    expect([good.reload.safe, bad.reload.safe]).to(eq([true, true]))
  end

  it "is enqueued when a link's URL changes" do
    expect { good.update!(url: "https://example.org") }.to(have_enqueued_job(described_class).with([good.id]))
    expect { good.update!(label: "Renamed") }.not_to(have_enqueued_job(described_class))
  end
end

RSpec.describe(RecheckPageLinksSafetyJob, type: :job) do
  it "rechecks links not checked in the last day" do
    stale = FactoryBot.create(:page_link)
    stale.update_columns(safe_checked_at: 2.days.ago)
    never = FactoryBot.create(:page_link)
    fresh = FactoryBot.create(:page_link)
    fresh.update_columns(safe_checked_at: 1.hour.ago)

    expect { described_class.perform_now }.to(have_enqueued_job(PageLinkSafetyJob).with(match_array([stale.id, never.id])))
  end
end

RSpec.describe(GoogleLib::SafeBrowsing::V4::Services, ".unsafe_urls") do
  before { stub_const("ENV", ENV.to_h.merge("GOOGLE_SAFE_LINK_KEY" => "test-key")) }

  it "returns the flagged URLs from one batched request" do
    stub = stub_request(:post, %r{\Ahttps://safebrowsing\.googleapis\.com/v4/threatMatches:find})
      .with { |request| JSON.parse(request.body).dig("threatInfo", "threatEntries").size == 2 }
      .to_return(
        status: 200,
        headers: { "Content-Type" => "application/json" },
        body: { matches: [{ threat: { url: "https://bad.example.com" } }] }.to_json,
      )

    result = described_class.unsafe_urls(["https://ok.example.com", "https://bad.example.com"])

    expect(result).to(eq(Set["https://bad.example.com"]))
    expect(stub).to(have_been_requested.once)
  end

  it "raises instead of flagging everything when the API fails" do
    stub_request(:post, %r{\Ahttps://safebrowsing\.googleapis\.com/}).to_return(status: 503)

    expect { described_class.unsafe_urls(["https://ok.example.com"]) }.to(raise_error(described_class::Error))
  end

  it "does not approve a URL when the key is rejected or the API is down" do
    [400, 503].each do |status|
      stub_request(:post, %r{\Ahttps://safebrowsing\.googleapis\.com/}).to_return(status: status, headers: { "Content-Type" => "application/json" }, body: { error: { code: status } }.to_json)

      expect { described_class.check_url("https://ok.example.com") }.to(raise_error(described_class::Error))
    end
  end

  it "is on only when a key is configured" do
    expect(described_class.enabled?).to(be(true))

    stub_const("ENV", ENV.to_h.merge("GOOGLE_SAFE_LINK_KEY" => ""))
    expect(described_class.enabled?).to(be(false))
  end
end

RSpec.describe(SafetyUrlJob, type: :job) do
  let(:link) { FactoryBot.create(:shortlink) }

  it "leaves the link as it was when Safe Browsing fails" do
    allow(GoogleLib::SafeBrowsing::V4::Services).to(receive(:check_url).and_raise(GoogleLib::SafeBrowsing::V4::Services::Error))

    described_class.perform_now(link.id)

    expect(link.reload).to(have_attributes(safe: true, inactive_at: nil))
  end

  it "does not enqueue without a Safe Browsing key" do
    stub_const("ENV", ENV.to_h.merge("GOOGLE_SAFE_LINK_KEY" => ""))

    expect { FactoryBot.create(:shortlink) }.not_to(have_enqueued_job(described_class))
  end
end
