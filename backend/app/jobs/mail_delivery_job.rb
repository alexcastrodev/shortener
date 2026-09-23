# Mail delivery with retries for transient failures (DNS hiccups, timeouts,
# the provider asking to slow down). A sign-in code expires in 15 minutes, so
# retries stay within about a minute; permanent errors (bad address, auth)
# fail at once and reach Sentry.
class MailDeliveryJob < ActionMailer::MailDeliveryJob
  queue_as :mailers

  retry_on Socket::ResolutionError,
    Net::OpenTimeout,
    Net::ReadTimeout,
    Errno::ECONNREFUSED,
    Errno::ECONNRESET,
    Net::SMTPServerBusy,
    wait: :polynomially_longer,
    attempts: 4
end
