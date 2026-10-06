class WaitlistMailer < ApplicationMailer
  def joined
    load_entry
    @leave_url = "#{frontend_url}/w/#{@entry.token}"
    with_recipient_locale(nil, @entry.locale) do
      mail(to: @entry.email, reply_to: @form.user.email, subject: I18n.t("waitlist_mailer.joined.subject", service: @service))
    end
  end

  def offered
    load_entry
    @url = "#{frontend_url}/w/#{@entry.token}"
    @until = @entry.offered_until.in_time_zone(@zone).strftime("%Y-%m-%d %H:%M (#{@zone})")
    with_recipient_locale(nil, @entry.locale) do
      mail(to: @entry.email, reply_to: @form.user.email, subject: I18n.t("waitlist_mailer.offered.subject", service: @service))
    end
  end

  private

  def frontend_url = ENV.fetch("FRONTEND_URL", "https://kurz.fyi")

  def load_entry
    @entry = params[:entry]
    @form = @entry.form
    booking = Appointments::Waitlist.booking_of(@form)
    @service = booking&.fetch("services", [])&.find { |item| item["id"] == @entry.service_key }&.fetch("name", nil).to_s.gsub(/[[:cntrl:]]+/, " ").strip
    @zone = Appointments::Book.valid_zone(@entry.time_zone) || "UTC"
    @when = @entry.starts_at.in_time_zone(@zone).strftime("%Y-%m-%d %H:%M (#{@zone})")
  end
end
