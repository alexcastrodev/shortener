class AppointmentMailer < ApplicationMailer
  # E02 (to the client) and E07 (to the owner). Built at send time from the
  # appointments of the notification's group, so the Notification itself only
  # carries ids.
  def confirmed
    load_group
    zone = Appointments::Book.valid_zone(@first.client_time_zone) || "UTC"
    @sessions = sessions(zone)
    last = @appointments.map { |appointment| appointment.slot.starts_at }.max
    @manage_url = "#{frontend_url}/m/#{AppointmentToken.issue(booking: @first, expires_at: last + 7.days)}"
    @total = @first.snapshot["total"]
    @currency = @first.snapshot["currency"]
    @free = @first.snapshot["free_sessions"].to_i

    with_recipient_locale(nil, @first.client_locale) do
      mail(
        to: @first.client_email,
        reply_to: @form.user.email,
        subject: I18n.t("appointment_mailer.confirmed.subject", service: @service, time: @sessions.first),
      )
    end
  end

  def cancelled
    load_group
    zone = Appointments::Book.valid_zone(@first.client_time_zone) || "UTC"
    @sessions = sessions(zone)

    with_recipient_locale(nil, @first.client_locale) do
      mail(
        to: @first.client_email,
        reply_to: @form.user.email,
        subject: I18n.t("appointment_mailer.cancelled.subject", service: @service, time: @sessions.first),
      )
    end
  end

  def reminder
    load_group
    zone = Appointments::Book.valid_zone(@first.client_time_zone) || "UTC"
    @sessions = sessions(zone)
    last = @appointments.map { |appointment| appointment.slot.starts_at }.max
    @manage_url = "#{frontend_url}/m/#{AppointmentToken.issue(booking: @first, expires_at: last + 7.days)}"

    with_recipient_locale(nil, @first.client_locale) do
      mail(
        to: @first.client_email,
        reply_to: @form.user.email,
        subject: I18n.t("appointment_mailer.reminder.subject", service: @service, time: @sessions.first),
      )
    end
  end

  def rescheduled
    load_group
    zone = Appointments::Book.valid_zone(@first.client_time_zone) || "UTC"
    moved = params[:notification].appointment
    old = Appointment.includes(:slot).find(moved.rescheduled_from_id)
    @was = "#{old.slot.starts_at.in_time_zone(zone).strftime("%Y-%m-%d %H:%M")} (#{zone})"
    @now = "#{moved.slot.starts_at.in_time_zone(zone).strftime("%Y-%m-%d %H:%M")} (#{zone})"
    @message = moved.decision_message.to_s.strip.presence
    last = @appointments.map { |appointment| appointment.slot.starts_at }.max
    @manage_url = "#{frontend_url}/m/#{AppointmentToken.issue(booking: @first, expires_at: last + 7.days)}"

    with_recipient_locale(nil, @first.client_locale) do
      mail(
        to: @first.client_email,
        reply_to: @form.user.email,
        subject: I18n.t("appointment_mailer.rescheduled.subject", service: @service, time: @now),
      )
    end
  end

  def request_received
    load_group
    zone = Appointments::Book.valid_zone(@first.client_time_zone) || "UTC"
    @sessions = sessions(zone)
    last = @appointments.map { |appointment| appointment.slot.starts_at }.max
    @manage_url = "#{frontend_url}/m/#{AppointmentToken.issue(booking: @first, expires_at: last + 7.days)}"

    with_recipient_locale(nil, @first.client_locale) do
      mail(
        to: @first.client_email,
        reply_to: @form.user.email,
        subject: I18n.t("appointment_mailer.request_received.subject", service: @service),
      )
    end
  end

  def new_request
    load_group
    owner = @form.user
    @sessions = sessions(owner.time_zone)
    @client_name = single_line(@first.client_name)
    @client_email = single_line(@first.client_email)
    @url = "#{frontend_url}/app/forms/#{@form.id}/responses"
    @deadline = @first.expires_at.in_time_zone(owner.time_zone).strftime("%Y-%m-%d %H:%M (#{owner.time_zone})")
    last = @appointments.map { |appointment| appointment.slot.starts_at }.max
    @decide_url = "#{frontend_url}/a/#{AppointmentToken.issue(booking: @first, expires_at: last + 7.days, purpose: "decide")}"

    with_recipient_locale(owner) do
      mail(
        to: owner.email,
        subject: I18n.t("appointment_mailer.new_request.subject", service: @service, name: @client_name.presence || I18n.t("appointment_mailer.new_booking.someone")),
      )
    end
  end

  def declined
    load_group
    zone = Appointments::Book.valid_zone(@first.client_time_zone) || "UTC"
    @sessions = sessions(zone)
    @message = @first.decision_message.to_s.strip.presence

    with_recipient_locale(nil, @first.client_locale) do
      mail(
        to: @first.client_email,
        reply_to: @form.user.email,
        subject: I18n.t("appointment_mailer.declined.subject", service: @service),
      )
    end
  end

  def verify
    load_group
    zone = Appointments::Book.valid_zone(@first.client_time_zone) || "UTC"
    @sessions = sessions(zone)
    @minutes = Forms::BookingSchema::VERIFY_MINUTES
    @verify_url = "#{frontend_url}/v/#{AppointmentToken.issue(booking: @first, expires_at: @first.expires_at + 1.hour, purpose: "verify")}"

    with_recipient_locale(nil, @first.client_locale) do
      mail(
        to: @first.client_email,
        subject: I18n.t("appointment_mailer.verify.subject", service: @service),
      )
    end
  end

  def new_booking
    load_group
    owner = @form.user
    @sessions = sessions(owner.time_zone)
    @client_name = single_line(@first.client_name)
    @client_email = single_line(@first.client_email)
    @url = "#{frontend_url}/app/forms/#{@form.id}/responses"

    with_recipient_locale(owner) do
      mail(
        to: owner.email,
        subject: I18n.t("appointment_mailer.new_booking.subject", service: @service, name: @client_name.presence || I18n.t("appointment_mailer.new_booking.someone")),
      )
    end
  end

  private

  def frontend_url = ENV.fetch("FRONTEND_URL", "https://kurz.fyi")

  def load_group
    notification = params[:notification]
    @appointments = Appointment.where(group_key: notification.appointment.group_key).where.not(status: "rescheduled").includes(:slot).references(:slot).order("appointment_slots.starts_at").to_a
    @first = @appointments.first
    @form = Form.find(@first.form_id)
    @service = single_line(@first.snapshot["name"])
  end

  def sessions(zone)
    @appointments.map { |appointment| "#{appointment.slot.starts_at.in_time_zone(zone).strftime("%Y-%m-%d %H:%M")} (#{zone})" }
  end

  # A customer's name ends up in a subject line.
  def single_line(value)
    value.to_s.gsub(/[[:cntrl:]]+/, " ").strip
  end
end
