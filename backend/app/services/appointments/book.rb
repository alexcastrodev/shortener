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

    def cast(form:, booking:, raw:, now: Time.current, claim_at: nil)
      return [nil, :invalid] unless Config.enabled_for?(form.user) && raw.is_a?(Hash)

      service = booking["services"].find { |item| item["id"] == raw["service"] }
      return cast_monthly(form: form, booking: booking, service: service, raw: raw["monthly"], now: now) if service && raw["monthly"]

      sessions = raw["sessions"]
      return [nil, :invalid] unless service && valid_sessions?(sessions)

      dates = sessions.map { |session| Date.iso8601(session["date"]) }
      return [nil, :invalid] if dates.max - dates.min >= Slots::MAX_RANGE_DAYS

      free = FreeSlots.call(form: form, booking: booking, service: service, from: dates.min, to: dates.max, now: now, releasing: claim_at)
      times = sessions.map { |session| free.find { |slot| slot[:date].iso8601 == session["date"] && slot[:time] == session["time"] } }
      return [nil, :unavailable] if times.any?(&:nil?)

      [{ "service" => service["id"], "sessions" => sessions.map { |session| session.slice("date", "time") }, "starts_at" => times.map { |slot| slot[:starts_at] }, "capacity" => service["capacity"] }, nil]
    rescue Date::Error
      [nil, :invalid]
    end

    def cast_monthly(form:, booking:, service:, raw:, now:)
      return [nil, :invalid] unless service["monthly"].is_a?(Hash) && raw.is_a?(Hash) && raw["time"].to_s.match?(TIME) && raw["month"].to_s.match?(/\A\d{4}-\d{2}\z/)

      weekdays = raw["weekdays"]
      return [nil, :invalid] unless weekdays.is_a?(Array) && weekdays.size.between?(1, 7) && weekdays.uniq.size == weekdays.size && (weekdays - Forms::BookingSchema::DAYS).empty?

      rules = booking["rules"]
      zone = Time.find_zone!(rules["time_zone"])
      today = now.in_time_zone(zone).to_date
      month = Date.strptime(raw["month"], "%Y-%m")
      return [nil, :invalid] unless [today.beginning_of_month, today.beginning_of_month.next_month].include?(month)

      from = [month, today].max
      wanted = (from..month.end_of_month).select { |date| weekdays.include?(Slots::WEEKDAYS[date.wday]) }
      offered = Slots.call(service: service, rules: rules, from: from, to: month.end_of_month, now: now, exceptions: booking["exceptions"].to_a)
      free = FreeSlots.call(form: form, booking: booking, service: service, from: from, to: month.end_of_month, now: now)
      picked = []
      skipped = []
      wanted.each do |date|
        next skipped << date.iso8601 unless offered.any? { |slot| slot[:date] == date && slot[:time] == raw["time"] }

        slot = free.find { |item| item[:date] == date && item[:time] == raw["time"] }
        return [nil, :unavailable] unless slot

        picked << slot
      end
      return [nil, :unavailable] if picked.empty?

      [{ "service" => service["id"], "sessions" => picked.map { |slot| { "date" => slot[:date].iso8601, "time" => slot[:time] } }, "starts_at" => picked.map { |slot| slot[:starts_at] }, "capacity" => service["capacity"], "monthly" => { "month" => raw["month"], "skipped" => skipped } }, nil]
    rescue Date::Error
      [nil, :invalid]
    end

    def call(form:, response:, value:, contact:, meta:, version:, held: false)
      service_key = value["service"]
      starts = value["starts_at"].uniq.sort
      ids = Reserve.call(form: form, service_key: service_key, capacity: value["capacity"], times: starts, held: held)
      slot_ids = starts.zip(ids).to_h
      booking = Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" }
      service = booking["services"].find { |item| item["id"] == service_key }
      rules = booking["rules"] || {}
      manual = needs_approval?(rules, starts)
      verify = !manual && rules["approval"] != "manual" && rules["verify_email"] == true && contact[:email].present?
      status = "confirmed"
      status = "pending" if manual
      status = "unverified" if verify
      expires_at = Time.current + rules.fetch("approval_timeout_minutes", Forms::BookingSchema::DEFAULT_TIMEOUT_MINUTES).minutes if manual
      expires_at = Time.current + Forms::BookingSchema::VERIFY_MINUTES.minutes if verify
      group = SecureRandom.uuid
      monthly = value["monthly"]
      monthly_price = service.dig("monthly", "price")
      priced = if monthly && monthly_price && service["currency"]
        { total: monthly_price.to_f, free_sessions: 0 }
      else
        Pricing.call(service: service, count: starts.size)
      end
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
          snapshot: service.slice("name", "duration", "price", "currency").merge("on_timeout" => (rules["approval_on_timeout"] if manual)).merge(pricing).merge("monthly" => monthly).compact,
          client_time_zone: meta[:time_zone],
          client_locale: meta[:locale],
          created_at: Time.current,
        }
      end
      Appointment.insert_all!(rows)
      first = response.appointments.order(:id).first
      payload = { form_id: form.id, response_id: response.id, group_key: group, sessions: rows.size }
      if verify
        queue_verification(first: first, group: group, email: contact[:email], payload: payload)
      else
        payload[:expires_at] = expires_at.iso8601 if manual
        announce(form: form, first: first, group: group, email: contact[:email], payload: payload, manual: manual)
      end
      response.appointments.order(:id)
    rescue Reserve::Full => e
      raise Full, e.starts_at
    end

    def announce(form:, first:, group:, email:, payload:, manual: false)
      Notification.notify_owner(user_id: form.user_id, kind: manual ? "appointment_requested" : "appointment_created", event_key: group, source: first, payload: payload)
      queue_emails(form: form, first: first, group: group, email: email, payload: payload, manual: manual)
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
      receipt[:skipped] = first.snapshot.dig("monthly", "skipped").to_a if first.snapshot["monthly"]
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

    def queue_verification(first:, group:, email:, payload:)
      queued = Notification.queue_email(kind: "appointment_verify", event_key: group, source: first, recipient_kind: "client", recipient_email: email, payload: payload)
      ActiveRecord.after_all_transactions_commit { NotificationDeliveryJob.perform_later(queued.id) }
    end

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
