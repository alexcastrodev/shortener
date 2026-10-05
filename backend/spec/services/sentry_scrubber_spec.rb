require "rails_helper"

RSpec.describe(SentryScrubber) do
  let(:config) { Sentry::Configuration.new.tap { |c| c.dsn = "http://key@localhost/1" } }
  let(:canary) { "CNRY-a-1-deadbeef" }

  it "strips request data, query, cookies, headers, env, breadcrumbs and DETAIL lines" do
    error = ActiveRecord::RecordNotUnique.new("PG::UniqueViolation: boom\nDETAIL:  Key (email)=(#{canary}) already exists.")
    event = Sentry::Client.new(config).event_from_exception(error)
    event.rack_env = Rack::MockRequest.env_for(
      "https://api.kurz.fyi/api/x?q=#{canary}",
      method: "POST",
      input: "answers=#{canary}",
      "HTTP_COOKIE" => "kurz_session=#{canary}",
      "HTTP_AUTHORIZATION" => "Bearer #{canary}",
      "REMOTE_ADDR" => "203.0.113.77",
    )
    event.breadcrumbs = Sentry::BreadcrumbBuffer.new(5)
    event.breadcrumbs.record(Sentry::Breadcrumb.new(message: canary))

    scrubbed = described_class.event(event).to_h.to_s

    expect(scrubbed).not_to(include(canary))
    expect(scrubbed).not_to(include("203.0.113.77"))
    expect(scrubbed).to(include("PG::UniqueViolation: boom"))
    expect(scrubbed).to(include("api.kurz.fyi/api/x"))
  end

  it "scrubs transaction events, which carry no exception" do
    transaction = Sentry::Event.new(configuration: config)
    transaction.rack_env = Rack::MockRequest.env_for("https://api.kurz.fyi/api/x?q=#{canary}", "HTTP_COOKIE" => "kurz_session=#{canary}", "REMOTE_ADDR" => "203.0.113.77")
    transaction.breadcrumbs = Sentry::BreadcrumbBuffer.new(5)
    transaction.breadcrumbs.record(Sentry::Breadcrumb.new(message: canary))

    expect(transaction).not_to(respond_to(:exception))
    scrubbed = described_class.event(transaction).to_h.to_s

    expect(scrubbed).not_to(include(canary))
    expect(scrubbed).not_to(include("203.0.113.77"))
  end

  it "drops noisy log lines and keeps the rest" do
    log = ->(body) { Sentry::LogEvent.new(configuration: config, level: :info, body: body) }

    expect(described_class.log(log.call("  Parameters: {\"answers\"=>\"#{canary}\"}"))).to(be_nil)
    expect(described_class.log(log.call("Enqueued X with arguments: #{canary}"))).to(be_nil)
    expect(described_class.log(log.call("Completed 200 OK in 3ms"))).not_to(be_nil)
  end
end
