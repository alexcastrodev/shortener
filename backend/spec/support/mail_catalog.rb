module MailCatalog
  MONDAY = Time.utc(2026, 10, 12, 8, 0)
  SERVICE = "Massagem <b>relax</b>".freeze
  FORM = "Estúdio <Ana> & Co".freeze
  CLIENT = "Rita <i>Silva</i>".freeze

  def catalog_mails(locale)
    owner = User.create!(email: "owner-#{locale.downcase}@example.com", time_zone: "Europe/Lisbon", locale: locale).tap(&:generate_login_token!)
    form = Form.create!(user: owner, title: FORM)
    service = { "name" => SERVICE, "duration" => 30, "price" => 40, "currency" => "EUR", "capacity" => 1, "days" => ["mon", "tue", "wed", "thu", "fri"], "times" => ["09:00", "15:00"] }
    Forms::Definition.add(form, { "type" => "booking", "label" => "When", "services" => [service], "rules" => { "time_zone" => "Europe/Lisbon", "waitlist" => true } })
    Forms::Publish.call(form: form.reload)
    form.reload
    service_key = form.fields.find { |field| field["type"] == "booking" }["services"].first["id"]
    group = lambda do |status, times, **attributes|
      key = SecureRandom.uuid
      free = times.size > 1 ? 1 : 0
      response = FormResponse.create!(form: form, answers: {})
      times.map do |time|
        slot = AppointmentSlot.find_or_create_by!(form: form, service_key: service_key, starts_at: time)
        Appointment.create!({
          form: form,
          response: response,
          slot: slot,
          group_key: key,
          status: status,
          client_name: CLIENT,
          client_email: "rita@example.com",
          client_time_zone: "Europe/Lisbon",
          client_locale: locale,
          snapshot: { "name" => SERVICE, "duration" => 30, "price" => 40, "currency" => "EUR", "total" => 40.0 * (times.size - free), "free_sessions" => free, "sessions" => times.size },
          created_at: Time.current,
        }.merge(attributes))
      end
    end
    notice = ->(rows, payload = {}) { Notification.new(appointment: rows.first, payload: payload) }
    mail = ->(rows, action, payload = {}) { AppointmentMailer.with(notification: notice.call(rows, payload)).public_send(action).message }

    booked = group.call("confirmed", [MONDAY, MONDAY + 2.days + 6.hours, MONDAY + 4.days])
    pending = group.call("pending", [MONDAY], expires_at: MONDAY - 1.day, snapshot: { "name" => SERVICE, "duration" => 30, "on_timeout" => "decline" })
    declined = group.call("declined", [MONDAY + 1.hour], decision_message: "Fechado <b>nesse</b> dia")
    unverified = group.call("unverified", [MONDAY + 1.day], expires_at: Time.current + 15.minutes)
    cancelled = group.call("cancelled", [MONDAY + 2.days], cancelled_by: "client", cancel_reason: "Doente <i>hoje</i>")
    old = group.call("rescheduled", [MONDAY + 3.days]).first
    moved = group.call("confirmed", [MONDAY + 3.days + 6.hours], rescheduled_from_id: old.id, decision_message: "Mudei <u>para a tarde</u>")
    entry = WaitlistEntry.create!(form: form, service_key: service_key, starts_at: MONDAY, name: CLIENT, email: "espera@example.com", locale: locale, time_zone: "Europe/Lisbon", status: "offered", offered_until: MONDAY - 2.days)
    leaving = User.create!(email: "leaving-#{locale.downcase}@example.com", locale: locale, deletion_requested_at: Time.current)

    {
      "appointment_mailer/confirmed" => -> { mail.call(booked, :confirmed) },
      "appointment_mailer/reminder" => -> { mail.call(booked, :reminder) },
      "appointment_mailer/new_booking" => -> { mail.call(booked, :new_booking) },
      "appointment_mailer/request_received" => -> { mail.call(pending, :request_received) },
      "appointment_mailer/new_request" => -> { mail.call(pending, :new_request) },
      "appointment_mailer/declined" => -> { mail.call(declined, :declined) },
      "appointment_mailer/verify" => -> { mail.call(unverified, :verify) },
      "appointment_mailer/cancelled" => -> { mail.call(cancelled, :cancelled, { "cancelled_ids" => cancelled.map(&:id) }) },
      "appointment_mailer/owner_cancelled" => -> { mail.call(cancelled, :owner_cancelled, { "cancelled_ids" => cancelled.map(&:id) }) },
      "appointment_mailer/rescheduled" => -> { mail.call(moved, :rescheduled) },
      "waitlist_mailer/joined" => -> { WaitlistMailer.with(entry: entry).joined.message },
      "waitlist_mailer/offered" => -> { WaitlistMailer.with(entry: entry).offered.message },
      "login_mailer/magic_link" => -> { LoginMailer.with(user: owner, locale: locale).magic_link.message },
      "account_mailer/data_export" => -> { AccountMailer.with(user: owner, body: "{}").data_export.message },
      "account_mailer/data_export_too_large" => -> { AccountMailer.with(user: owner).data_export_too_large.message },
      "account_mailer/deletion_scheduled" => -> { AccountMailer.with(user: leaving).deletion_scheduled.message },
    }
  end
end
