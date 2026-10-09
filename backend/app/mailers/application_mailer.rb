class ApplicationMailer < ActionMailer::Base
  helper MailerHelper

  # The sender has to match the SMTP provider (see config/mail_settings.rb):
  # a mismatched From is rewritten by Gmail and read as spoofing by filters.
  default from: -> { MailSettings.from }
  layout "mailer"
  self.delivery_job = MailDeliveryJob

  def self.recipient_locale(requested, recipient = nil, owner = nil)
    [requested, recipient&.locale, owner&.locale].map(&:to_s).find { |tag| User::LOCALES.include?(tag) } || I18n.default_locale.to_s
  end

  private

  def with_recipient_locale(requested, recipient = nil, owner = nil, &)
    I18n.with_locale(self.class.recipient_locale(requested, recipient, owner), &)
  end

  def frontend_url = ENV.fetch("FRONTEND_URL", "https://kurz.fyi")

  def mail_short(time, zone) = I18n.l(time.in_time_zone(zone), format: :mail_short)

  def single_line(value)
    value.to_s.gsub(/[[:cntrl:]]+/, " ").strip
  end

  def client_footer(why, reply: true)
    @footer_lines = [I18n.t("mailer.on_behalf", form: @form_title), (I18n.t("mailer.reply", form: @form_title) if reply), I18n.t(why, form: @form_title)].compact
  end
end
