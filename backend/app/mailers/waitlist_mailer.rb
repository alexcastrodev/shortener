class WaitlistMailer < ApplicationMailer
  def joined
    load_entry(:waitlist)
    @leave_url = "#{frontend_url}/w/#{@entry.token}"
    to_entry
  end

  def offered
    load_entry(:offered)
    @url = "#{frontend_url}/w/#{@entry.token}"
    @until = @entry.offered_until
    to_entry
  end

  private

  def load_entry(status)
    @status = status
    @entry = params[:entry]
    @form = @entry.form
    @form_title = single_line(@form.title)
    booking = Appointments::Waitlist.booking_of(@form)
    service = booking&.fetch("services", [])&.find { |item| item["id"] == @entry.service_key } || {}
    @service = single_line(service["name"])
    @zone = Appointments::Book.valid_zone(@entry.time_zone) || Appointments::Book.valid_zone(booking&.dig("rules", "time_zone")) || "UTC"
    @booking = { service: @service, starts: [@entry.starts_at], zone: @zone, minutes: service["duration"], who: [:with, @form_title] }
  end

  def to_entry
    with_recipient_locale(@entry.locale, Notification.client_account(@entry.email), @form.user) do
      client_footer("mailer.why_waitlist")
      mail(to: @entry.email, reply_to: @form.user.email, subject: I18n.t("waitlist_mailer.#{action_name}.subject", service: @service, time: mail_short(@entry.starts_at, @zone)))
    end
  end
end
