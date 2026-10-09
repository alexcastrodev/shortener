class AppointmentMailer < ApplicationMailer
  # E02 (to the client) and E07 (to the owner). Built at send time from the
  # appointments of the notification's group, so the Notification itself only
  # carries ids.
  def confirmed
    load_group(:confirmed)
    @manage_url = manage_url
    to_client
  end

  def cancelled
    load_group(:cancelled)
    @by_owner = @first.cancelled_by == "owner"
    @book_again_url = book_again_url
    to_client
  end

  def owner_cancelled
    load_group(:cancelled)
    @reason = single_line(@first.cancel_reason).presence
    to_owner
  end

  def reminder
    load_group(:reminder)
    @manage_url = manage_url
    to_client
  end

  def rescheduled
    load_group(:rescheduled)
    moved = params[:notification].appointment
    @starts = [moved.slot.starts_at]
    @was = Appointment.includes(:slot).find(moved.rescheduled_from_id).slot.starts_at
    @message = moved.decision_message.to_s.strip.presence
    @manage_url = manage_url
    to_client
  end

  def request_received
    load_group(:pending)
    @manage_url = manage_url
    to_client
  end

  def new_request
    load_group(:pending)
    @deadline = @first.expires_at
    @accept_on_timeout = @first.snapshot["on_timeout"] == "accept"
    @decide_url = "#{frontend_url}/a/#{token(purpose: "decide")}"
    to_owner
  end

  def declined
    load_group(:declined)
    @message = @first.decision_message.to_s.strip.presence
    @book_again_url = book_again_url
    to_client
  end

  def verify
    load_group(:verify)
    @minutes = Forms::BookingSchema::VERIFY_MINUTES
    @verify_url = "#{frontend_url}/v/#{AppointmentToken.issue(booking: @first, expires_at: @first.expires_at + 1.hour, purpose: "verify")}"
    to_client(reply: false)
  end

  def new_booking
    load_group(:new_booking)
    to_owner
  end

  private

  def load_group(status)
    notification = params[:notification]
    @status = status
    @appointments = Appointment.where(group_key: notification.appointment.group_key).where.not(status: "rescheduled").includes(:slot).references(:slot).order("appointment_slots.starts_at").to_a
    only = notification.payload["cancelled_ids"]
    @appointments = @appointments.select { |row| only.include?(row.id) } if only.present?
    @first = @appointments.first
    @form = Form.find(@first.form_id)
    @form_title = single_line(@form.title)
    @service = single_line(@first.snapshot["name"])
  end

  def to_client(reply: true)
    zone = Appointments::Book.valid_zone(@first.client_time_zone) || Appointments::Book.valid_zone(Appointments::Waitlist.booking_of(@form)&.dig("rules", "time_zone")) || "UTC"
    with_recipient_locale(@first.client_locale, Notification.client_account(@first.client_email), @form.user) do
      @booking = details(zone, [:with, @form_title])
      client_footer("mailer.why_client", reply: reply)
      mail({ to: @first.client_email, reply_to: (@form.user.email if reply), subject: I18n.t("appointment_mailer.#{action_name}.subject", service: @service, time: mail_short(@booking[:starts].first, zone)) }.compact)
    end
  end

  def to_owner
    owner = @form.user
    with_recipient_locale(nil, owner) do
      @client_name = single_line(@first.client_name).presence || I18n.t("mailer.someone")
      @booking = details(owner.time_zone, [:client, [@client_name, single_line(@first.client_email)].compact_blank.join(" · ")])
      @responses_url = "#{frontend_url}/app/forms/#{@form.id}/responses"
      @footer_lines = [I18n.t("mailer.why_owner", form: @form_title)]
      @footer_link = [I18n.t("mailer.settings"), "#{frontend_url}/app/account"]
      mail(to: owner.email, subject: I18n.t("appointment_mailer.#{action_name}.subject", service: @service, name: @client_name, time: mail_short(@booking[:starts].first, owner.time_zone)))
    end
  end

  def details(zone, who)
    snapshot = @first.snapshot
    {
      service: @service,
      starts: @starts || @appointments.map { |appointment| appointment.slot.starts_at },
      zone: zone,
      minutes: snapshot["duration"],
      who: who,
      total: ([snapshot["total"], snapshot["currency"], snapshot["free_sessions"]] if snapshot["total"]),
    }
  end

  def token(purpose: "manage")
    last = @appointments.map { |appointment| appointment.slot.starts_at }.max
    AppointmentToken.issue(booking: @first, expires_at: last + 7.days, purpose: purpose)
  end

  def manage_url = "#{frontend_url}/m/#{token}"

  def book_again_url
    "#{frontend_url}/f/#{@form.public_id}" if @form.published && @form.accepting_responses
  end
end
