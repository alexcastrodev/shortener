class ApplicationMailer < ActionMailer::Base
  # The sender has to match the SMTP provider (see config/mail_settings.rb):
  # a mismatched From is rewritten by Gmail and read as spoofing by filters.
  default from: -> { MailSettings.from }
  layout "mailer"
  self.delivery_job = MailDeliveryJob
end
