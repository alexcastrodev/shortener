module Oauth
  module SecurityEvent
    extend self

    def record(name, grant_id:)
      Rails.logger.warn("[oauth] event=#{name} grant=#{grant_id}")
      Sentry.capture_message("OAuth #{name}", level: :warning, tags: { oauth_event: name }) if defined?(Sentry) && Sentry.initialized?
    end
  end
end
