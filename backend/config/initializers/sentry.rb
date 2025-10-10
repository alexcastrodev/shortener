# frozen_string_literal: true

if Rails.env.production? && ENV["SENTRY_DSN"].present?
  Sentry.init do |config|
    config.breadcrumbs_logger = [:active_support_logger]
    config.dsn = ENV["SENTRY_DSN"]
    config.profiles_sample_rate = 1.0
    # https://docs.sentry.io/platforms/ruby/configuration/options/#tracing-options
    config.traces_sample_rate = 1.0
    config.enable_logs = ENV["SENTRY_LOGGER"].present?
    config.enabled_patches = [:logger]
  end
end
