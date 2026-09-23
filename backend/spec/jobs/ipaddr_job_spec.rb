require "rails_helper"

RSpec.describe(IpaddrJob, type: :job) do
  describe "#perform" do
    it "schedules a retry with retry_count = 1 when starting with retry_count = 0" do
      allow(HTTParty).to(receive(:get).and_raise(StandardError.new("network error")))

      allow(IpaddrJob).to(receive(:perform_later))
      user = User.create!(email: "test+#{SecureRandom.hex(4)}@example.com")
      short_code = "sc#{SecureRandom.hex(4)}"
      event = Event.create!(shortlink: Shortlink.create!(original_url: "https://example.com", short_code: short_code, user: user), ip_address: "1.2.3.4", clicked_at: Time.current)
      allow(IpaddrJob).to(receive(:perform_later).and_call_original)

      set_spy = spy("set_return_0")
      allow(IpaddrJob).to(receive(:set).and_return(set_spy))
      perform_enqueued_jobs do
        IpaddrJob.perform_later(event.id, retry_count: 0)
      end
      expect(set_spy).to(have_received(:perform_later).with(event.id, retry_count: 1))
    end

    it "schedules a retry with retry_count = 5 when starting with retry_count = 4" do
      allow(HTTParty).to(receive(:get).and_raise(StandardError.new("network error")))

      allow(IpaddrJob).to(receive(:perform_later))
      user = User.create!(email: "test+#{SecureRandom.hex(4)}@example.com")
      short_code = "sc#{SecureRandom.hex(4)}"
      event = Event.create!(shortlink: Shortlink.create!(original_url: "https://example.com", short_code: short_code, user: user), ip_address: "1.2.3.4", clicked_at: Time.current)
      allow(IpaddrJob).to(receive(:perform_later).and_call_original)

      set_spy = spy("set_return_4")
      allow(IpaddrJob).to(receive(:set).and_return(set_spy))
      perform_enqueued_jobs do
        IpaddrJob.perform_later(event.id, retry_count: 4)
      end
      expect(set_spy).to(have_received(:perform_later).with(event.id, retry_count: 5))
    end

    it "does not schedule further attempts when starting with retry_count = 5" do
      allow(HTTParty).to(receive(:get).and_raise(StandardError.new("network error")))

      allow(IpaddrJob).to(receive(:perform_later))
      user = User.create!(email: "test+#{SecureRandom.hex(4)}@example.com")
      short_code = "sc#{SecureRandom.hex(4)}"
      event = Event.create!(shortlink: Shortlink.create!(original_url: "https://example.com", short_code: short_code, user: user), ip_address: "1.2.3.4", clicked_at: Time.current)
      allow(IpaddrJob).to(receive(:perform_later).and_call_original)

      set_spy = spy("set_return_5")
      allow(IpaddrJob).to(receive(:set).and_return(set_spy))
      perform_enqueued_jobs do
        IpaddrJob.perform_later(event.id, retry_count: 5)
      end
      expect(set_spy).not_to(have_received(:perform_later))
    end
  end

  describe "enqueueing" do
    let(:user) { User.create!(email: "test+#{SecureRandom.hex(4)}@example.com") }
    let(:shortlink) { Shortlink.create!(original_url: "https://example.com", user: user) }

    it "is skipped when the edge already sent country and region" do
      expect do
        Event.create!(shortlink: shortlink, ip_address: "1.2.3.4", country_code: "BR", region: "Sao Paulo")
      end.not_to(have_enqueued_job(IpaddrJob))
    end

    it "is enqueued when the region is missing" do
      expect do
        Event.create!(shortlink: shortlink, ip_address: "1.2.3.4", country_code: "BR")
      end.to(have_enqueued_job(IpaddrJob))
    end
  end

  describe "filling missing location" do
    it "keeps the country from the edge and fills the region" do
      user = User.create!(email: "test+#{SecureRandom.hex(4)}@example.com")
      shortlink = Shortlink.create!(original_url: "https://example.com", user: user)
      event = Event.create!(shortlink: shortlink, ip_address: "1.2.3.4", country_code: "BR")
      response = instance_double(
        HTTParty::Response,
        code: 200,
        parsed_response: { "status" => "success", "countryCode" => "US", "regionName" => "California" },
      )
      allow(HTTParty).to(receive(:get).and_return(response))

      IpaddrJob.perform_now(event.id)

      event.reload
      expect(event.country_code).to(eq("BR"))
      expect(event.region).to(eq("California"))
    end
  end

  describe "bio page clicks" do
    let(:click) do
      page = FactoryBot.create(:page)
      link = FactoryBot.create(:page_link, page: page)
      link.page_link_clicks.create!(ip_address: "1.2.3.4")
    end

    it "fills the location of a PageLinkClick" do
      response = instance_double(
        HTTParty::Response,
        code: 200,
        parsed_response: { "status" => "success", "countryCode" => "PT", "regionName" => "Lisbon" },
      )
      allow(HTTParty).to(receive(:get).and_return(response))

      IpaddrJob.perform_now(click.id, model: "PageLinkClick")

      expect(click.reload).to(have_attributes(country_code: "PT", region: "Lisbon"))
    end

    it "keeps the model when retrying" do
      allow(HTTParty).to(receive(:get).and_raise(StandardError.new("network error")))
      set_spy = spy("set_return")
      allow(IpaddrJob).to(receive(:set).and_return(set_spy))

      IpaddrJob.perform_now(click.id, model: "PageLinkClick")

      expect(set_spy).to(have_received(:perform_later).with(click.id, model: "PageLinkClick", retry_count: 1))
    end

    it "ignores models outside the allowlist" do
      expect(HTTParty).not_to(receive(:get))

      IpaddrJob.perform_now(1, model: "User")
    end
  end
end
