class ApplicationMailer < ActionMailer::Base
  # Mail goes out through the Gmail account's SMTP, so the sender must be that
  # account: any other address is rewritten by Gmail and left in
  # X-Google-Original-From, which spam filters read as spoofing.
  default from: -> { email_address_with_name(ENV.fetch("GMAIL_USERNAME", "kurz.fyi@gmail.com"), "Kurz") }
  layout "mailer"
end
