# frozen_string_literal: true

Sentry.init do |config|
  config.breadcrumbs_logger = [ :active_support_logger ]
  config.dsn = ENV["SENTRY_DSN"]
  config.profiles_sample_rate = 0.7
  # https://docs.sentry.io/platforms/ruby/configuration/options/#tracing-options
  config.traces_sample_rate = 0.7
end
