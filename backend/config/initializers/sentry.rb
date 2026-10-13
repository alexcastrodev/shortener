# frozen_string_literal: true

if Rails.env.production? && ENV["SENTRY_DSN"].present?
  Sentry.init do |config|
    config.breadcrumbs_logger = [:active_support_logger]
    config.dsn = ENV["SENTRY_DSN"]
    config.profiles_sample_rate = ENV.fetch("SENTRY_PROFILES_SAMPLE_RATE", "0.5").to_f
    # https://docs.sentry.io/platforms/ruby/configuration/options/#tracing-options
    config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f
    # Logs are always on since sentry-ruby 7 (enable_logs was removed); the :logger patch
    # is what forwards Rails.logger lines, so only enable it when SENTRY_LOGGER is set.
    config.enabled_patches = ENV["SENTRY_LOGGER"].present? ? [:logger] : []
    config.send_default_pii = false
    # Lambdas: SentryScrubber is autoloaded, so it can't be referenced while initializers run.
    config.before_send = ->(event, hint) { SentryScrubber.event(event, hint) }
    config.before_send_transaction = ->(event, hint) { SentryScrubber.event(event, hint) }
    config.before_send_log = ->(log) { SentryScrubber.log(log) }
  end
end
