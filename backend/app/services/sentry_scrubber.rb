# Keeps request bodies, query strings, cookies, headers, IPs, breadcrumbs and Postgres
# "DETAIL: Key (col)=(value)" lines out of Sentry. Wired in config/initializers/sentry.rb.
module SentryScrubber
  PG_DETAIL = /DETAIL:.*/m
  NOISY_LOG = /Parameters:|with arguments|#{PG_DETAIL.source}/

  extend self

  def event(event, _hint = nil)
    if (request = event.request)
      request.data = nil
      request.query_string = nil
      request.cookies = nil
      request.headers = nil
      request.env = nil
      request.url = request.url&.split("?")&.first
    end
    event.breadcrumbs = nil
    event.exception&.values&.each { |e| e.value = e.value&.sub(PG_DETAIL, "DETAIL: [FILTERED]") }
    event
  end

  # Returning nil drops the log line.
  def log(log_event)
    log_event.body.to_s.match?(NOISY_LOG) ? nil : log_event
  end
end
