require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = false
  config.consider_all_requests_local = false
  config.public_file_server.headers = { "cache-control" => "public, max-age=3600" }
  config.action_dispatch.show_exceptions = :rescuable
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")
  config.log_tags = [:request_id]
  config.logger = ActiveSupport::TaggedLogging.logger($stdout)
  config.active_support.report_deprecations = false
  config.active_storage.service = :test
  config.active_job.queue_adapter = :inline
  config.active_job.log_arguments = false
  config.action_mailer.delivery_method = :smtp
  config.action_mailer.smtp_settings = {
    address: ENV.fetch("E2E_SMTP_HOST", "localhost"),
    port: ENV.fetch("E2E_SMTP_PORT", 1025).to_i,
    enable_starttls_auto: false,
  }
  config.action_mailer.raise_delivery_errors = true
  config.action_mailer.deliver_later_queue_name = :mailers
  config.action_mailer.default_url_options = { host: URI.parse(ENV.fetch("FRONTEND_URL", "http://localhost:3001")).host }
  config.i18n.fallbacks = true
  config.active_record.attributes_for_inspect = [:id]
end
