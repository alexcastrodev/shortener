require "rails_helper"

RSpec.describe(MailDeliveryJob, type: :job) do
  let(:user) { FactoryBot.create(:user) }
  let(:enqueued) { ActiveJob::Base.queue_adapter.enqueued_jobs }

  def enqueue_magic_link
    LoginMailer.with(user: user, purpose: "sign_in", locale: "en").magic_link.deliver_later
    enqueued.pop
  end

  def run(job)
    ActiveJob::Base.execute(job.except("scheduled_at").stringify_keys)
  end

  def fail_delivery_with(error)
    allow_any_instance_of(Mail::TestMailer).to(receive(:deliver!).and_raise(error.new("smtp")))
  end

  [Socket::ResolutionError, Net::OpenTimeout, Errno::ECONNRESET, Net::SMTPServerBusy].each do |error|
    it "retries #{error} with a wait and raises on the fourth attempt" do
      fail_delivery_with(error)
      job = enqueue_magic_link

      3.times do |attempt|
        expect { run(job) }.not_to(raise_error)
        job = enqueued.pop
        expect(job).to(include("job_class" => "MailDeliveryJob", "executions" => attempt + 1))
        expect(job["scheduled_at"]).to(be_present)
      end

      expect { run(job) }.to(raise_error(error))
      expect(enqueued).to(be_empty)
    end
  end

  [Net::SMTPAuthenticationError, Net::SMTPFatalError].each do |error|
    it "raises #{error} on the first attempt and does not retry" do
      fail_delivery_with(error)
      job = enqueue_magic_link

      expect { run(job) }.to(raise_error(error))
      expect(enqueued).to(be_empty)
    end
  end

  it "is the delivery job of every mailer in the app" do
    Rails.application.eager_load!

    expect(ApplicationMailer.delivery_job).to(eq(described_class))
    expect(ApplicationMailer.descendants).not_to(be_empty)
    expect(ApplicationMailer.descendants.map(&:delivery_job)).to(all(eq(described_class)))
  end

  it "enqueues deliver_later on MailDeliveryJob" do
    expect { LoginMailer.with(user: user, purpose: "sign_in", locale: "en").magic_link.deliver_later }
      .to(have_enqueued_job(described_class))
  end
end
