class ApplicationMailer < ActionMailer::Base
  # The sender has to match the SMTP provider (see config/mail_settings.rb):
  # a mismatched From is rewritten by Gmail and read as spoofing by filters.
  default from: -> { MailSettings.from }
  layout "mailer"
  self.delivery_job = MailDeliveryJob

  private

  # The language the person is looking at when they ask for the email, then
  # their saved preference, then English.
  def with_recipient_locale(user, requested = nil, &)
    locale = [requested, user&.locale].map(&:to_s).find { |tag| User::LOCALES.include?(tag) }
    I18n.with_locale(locale || I18n.default_locale, &)
  end
end
