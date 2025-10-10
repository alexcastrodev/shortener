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
end
