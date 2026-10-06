module Appointments
  module Book
    extend self

    MAX_SESSIONS = 31
    LOCALES = ["en", "pt-PT"].freeze
    DATE = /\A\d{4}-\d{2}-\d{2}\z/
    TIME = /\A([01]\d|2[0-3]):[0-5]\d\z/

    class Full < StandardError
      attr_reader :starts_at

      def initialize(starts_at)
        @starts_at = starts_at
        super("slot_full")
      end
    end

    def cast(form:, booking:, raw:, now: Time.current)
      return [nil, :invalid] unless Config.enabled_for?(form.user) && raw.is_a?(Hash)

      service = booking["services"].find { |item| item["id"] == raw["service"] }
      sessions = raw["sessions"]
      return [nil, :invalid] unless service && valid_sessions?(sessions)

      dates = sessions.map { |session| Date.iso8601(session["date"]) }
      return [nil, :invalid] if dates.max - dates.min >= Slots::MAX_RANGE_DAYS

      free = FreeSlots.call(form: form, booking: booking, service: service, from: dates.min, to: dates.max, now: now)
      times = sessions.map { |session| free.find { |slot| slot[:date].iso8601 == session["date"] && slot[:time] == session["time"] } }
      return [nil, :unavailable] if times.any?(&:nil?)

      [{ "service" => service["id"], "sessions" => sessions.map { |session| session.slice("date", "time") }, "starts_at" => times.map { |slot| slot[:starts_at] }, "capacity" => service["capacity"] }, nil]
    rescue Date::Error
      [nil, :invalid]
    end

    def call(form:, response:, value:, contact:, meta:, version:)
      service_key = value["service"]
      starts = value["starts_at"].uniq.sort
      ids = Reserve.call(form: form, service_key: service_key, capacity: value["capacity"], times: starts)
      slot_ids = starts.zip(ids).to_h
      booking = Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" }
      service = booking["services"].find { |item| item["id"] == service_key }
      rules = booking["rules"] || {}
      manual = needs_approval?(rules, starts)
      status = manual ? "pending" : "confirmed"
      expires_at = Time.current + rules.fetch("approval_timeout_minutes", Forms::BookingSchema::DEFAULT_TIMEOUT_MINUTES).minutes if manual
      group = SecureRandom.uuid
      priced = Pricing.call(service: service, count: starts.size)
      pricing = priced ? { "total" => priced[:total], "free_sessions" => priced[:free_sessions], "sessions" => starts.size } : {}
      rows = starts.map do |time|
        {
          form_id: form.id,
          response_id: response.id,
          slot_id: slot_ids.fetch(time),
          group_key: group,
          status: status,
          expires_at: expires_at,
          client_name: contact[:name],
          client_email: contact[:email],
          published_version: version,
          snapshot: service.slice("name", "duration", "price", "currency").merge("on_timeout" => (rules["approval_on_timeout"] if manual)).merge(pricing).compact,
          client_time_zone: meta[:time_zone],
          client_locale: meta[:locale],
          created_at: Time.current,
        }
      end
      Appointment.insert_all!(rows)
      first = response.appointments.order(:id).first
      payload = { form_id: form.id, response_id: response.id, group_key: group, sessions: rows.size }
      payload[:expires_at] = expires_at.iso8601 if manual
      Notification.notify_owner(user_id: form.user_id, kind: manual ? "appointment_requested" : "appointment_created", event_key: group, source: first, payload: payload)
      queue_emails(form: form, first: first, group: group, email: contact[:email], payload: payload, manual: manual)
      response.appointments.order(:id)
    rescue Reserve::Full => e
      raise Full, e.starts_at
    end

    def needs_approval?(rules, starts, now: Time.current)
      return false unless rules["approval"] == "manual"

      limit = rules["approval_within_minutes"]
      limit.nil? || starts.min < now + limit.minutes
    end

    def summary(response)
      response.appointments.includes(:slot).order("appointment_slots.starts_at").references(:slot).map do |appointment|
        { starts_at: appointment.slot.starts_at.iso8601, service: appointment.snapshot["name"], status: appointment.status }
      end
    end

    def receipt(response, now: Time.current)
      rows = response.appointments.includes(:slot).to_a
      return if rows.empty?

      first = rows.min_by(&:id)
      last = rows.map { |row| row.slot.starts_at }.max
      raw = AppointmentToken.issue(booking: first, expires_at: [last, now].max + 7.days)
      receipt = { manage_url: "#{ENV.fetch("FRONTEND_URL", "https://kurz.fyi")}/m/#{raw}", email_delivery: first.client_email.present? ? "queued" : "none" }
      receipt[:price] = { total: first.snapshot["total"], currency: first.snapshot["currency"], free_sessions: first.snapshot["free_sessions"] } if first.snapshot["total"]
      receipt
    end

    def valid_zone(value)
      value if value.is_a?(String) && TZInfo::Timezone.all_identifiers.include?(value)
    end

    def valid_locale(value)
      value if LOCALES.include?(value)
    end

    private

    def queue_emails(form:, first:, group:, email:, payload:, manual: false)
      queued = [Notification.queue_email(kind: manual ? "appointment_requested" : "appointment_created", event_key: group, source: first, recipient_kind: "owner", user_id: form.user_id, payload: payload)]
      if email.present?
        queued << Notification.queue_email(kind: manual ? "appointment_request_received" : "appointment_confirmed", event_key: group, source: first, recipient_kind: "client", recipient_email: email, payload: payload)
      end
      ids = queued.compact.map(&:id)
      ActiveRecord.after_all_transactions_commit { ids.each { |id| NotificationDeliveryJob.perform_later(id) } }
    end

    def valid_sessions?(sessions)
      sessions.is_a?(Array) && sessions.size.between?(1, MAX_SESSIONS) &&
        sessions.all? { |session| session.is_a?(Hash) && session["date"].is_a?(String) && session["date"].match?(DATE) && session["time"].is_a?(String) && session["time"].match?(TIME) } &&
        sessions.map { |session| session.values_at("date", "time") }.uniq.size == sessions.size
    end
  end
end
