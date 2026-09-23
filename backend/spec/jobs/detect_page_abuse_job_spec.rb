require "rails_helper"

RSpec.describe(DetectPageAbuseJob) do
  let(:bio) { "Claim your free crypto giveaway now, limited slots" }

  def campaign_page(user_created_at: 1.day.ago, bio: self.bio, url: "https://phish.example.net/login")
    user = FactoryBot.create(:user, created_at: user_created_at)
    page = FactoryBot.create(:page, user: user, slug: "p-#{SecureRandom.hex(4)}", display_title: "Giveaway", bio: bio)
    page.page_links.create!(kind: "link", label: "Claim", url: url, position: 1) if url
    page
  end

  before do
    allow(Sentry).to(receive(:capture_message))
  end

  it "flags three new accounts with the same text and the same links" do
    pages = Array.new(3) { campaign_page }

    described_class.perform_now

    expect(AbuseSignal.pluck(:kind)).to(contain_exactly("same_text", "same_links"))
    expect(AbuseSignal.first.page_ids).to(match_array(pages.map(&:id)))
    expect(AbuseSignal.first.user_ids).to(match_array(pages.map(&:user_id)))
    expect(Sentry).to(have_received(:capture_message).twice)
  end

  it "does not flag two accounts" do
    2.times { campaign_page }

    described_class.perform_now

    expect(AbuseSignal.count).to(eq(0))
  end

  it "ignores old accounts" do
    2.times { campaign_page }
    campaign_page(user_created_at: 30.days.ago)

    described_class.perform_now

    expect(AbuseSignal.count).to(eq(0))
  end

  it "ignores short texts and placeholder-only links" do
    3.times { campaign_page(bio: nil, url: BuiltInPageTemplates::PLACEHOLDER) }

    described_class.perform_now

    expect(AbuseSignal.count).to(eq(0))
  end

  it "merges new pages into an existing signal on the next run" do
    3.times { campaign_page(url: nil) }
    described_class.perform_now
    campaign_page(url: nil)

    described_class.perform_now

    expect(AbuseSignal.count).to(eq(1))
    expect(AbuseSignal.first.page_ids.size).to(eq(4))
    expect(Sentry).to(have_received(:capture_message).once)
  end

  describe "admin endpoints", type: :request do
    include_context "authenticated user"

    before { host! "localhost" }

    it "lists open signals with owners and dismisses them" do
      3.times { campaign_page(url: nil) }
      described_class.perform_now
      signal = AbuseSignal.first

      get "/api/admin/abuse_signals", headers: auth_headers
      expect(response).to(have_http_status(:forbidden))

      get "/api/admin/abuse_signals", headers: admin_auth_headers
      body = JSON.parse(response.body)["abuse_signal"]
      expect(body.size).to(eq(1))
      expect(body.first["users"].size).to(eq(3))
      expect(body.first["pages"].first).to(include("display_title" => "Giveaway"))

      post "/api/admin/abuse_signals/#{signal.id}/dismiss", headers: admin_auth_headers
      expect(response).to(have_http_status(:no_content))
      expect(signal.reload.status).to(eq("dismissed"))

      get "/api/admin/abuse_signals", headers: admin_auth_headers
      expect(JSON.parse(response.body)["abuse_signal"]).to(be_empty)
    end
  end
end
