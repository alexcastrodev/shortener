module Appointments
  module Book
    extend self

    MAX_SESSIONS = 31
    ITEMS_MAX = 5
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

    delegate :cast, :items_of, :cast_item, to: :Cast
    delegate :announce, to: :Notify
    delegate :summary, :receipt, :manage_url, to: :Receipt

    def call(form:, response:, value:, contact:, meta:, version:, held: false)
      items = value["items"]
      booking = Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" }
      rules = booking["rules"] || {}
      hold_daily_limit(form, rules, items)
      reserved = items.sort_by { |item| item["starts_at"].min }.map { |item| reserve(form, booking, item, held) }
      starts = reserved.flat_map { |entry| entry[:starts] }
      manual = needs_approval?(rules, starts)
      verify = !manual && rules["approval"] != "manual" && rules["verify_email"] == true && contact[:email].present?
      status = "confirmed"
      status = "pending" if manual
      status = "unverified" if verify
      expires_at = Time.current + rules.fetch("approval_timeout_minutes", Forms::BookingSchema::DEFAULT_TIMEOUT_MINUTES).minutes if manual
      expires_at = Time.current + Forms::BookingSchema::VERIFY_MINUTES.minutes if verify
      group = SecureRandom.uuid
      totals = reserved.filter_map { |entry| total_of(entry) }
      pricing = totals.any? ? { "total" => totals.sum(BigDecimal("0")).round(2).to_f, "sessions" => starts.size } : {}
      rows = reserved.flat_map do |entry|
        service = entry[:service]
        entry[:starts].map do |time|
          minutes = entry[:lengths].fetch(time.to_i)
          snapshot = service.slice("name", "duration", "price", "currency")
            .merge("duration" => minutes, "price" => Durations.option(service, minutes)&.dig("price") || service["price"])
            .merge("on_timeout" => (rules["approval_on_timeout"] if manual))
            .merge(pricing)
            .merge("monthly" => entry[:monthly])
            .compact
          {
            form_id: form.id,
            response_id: response.id,
            slot_id: entry[:slot_ids].fetch(time),
            group_key: group,
            status: status,
            expires_at: expires_at,
            client_name: contact[:name],
            client_email: contact[:email],
            published_version: version,
            snapshot: snapshot,
            client_time_zone: meta[:time_zone],
            client_locale: meta[:locale],
            created_at: Time.current,
          }
        end
      end
      Appointment.insert_all!(rows)
      first = response.appointments.order(:id).first
      payload = { form_id: form.id, response_id: response.id, group_key: group, sessions: rows.size }
      if verify
        Notify.queue_verification(first: first, group: group, email: contact[:email], payload: payload)
      else
        payload[:expires_at] = expires_at.iso8601 if manual
        Notify.announce(form: form, first: first, group: group, email: contact[:email], payload: payload, manual: manual)
      end
      response.appointments.order(:id)
    rescue Reserve::Full => e
      raise Full, e.starts_at
    end

    def needs_approval?(rules, starts, now: Time.current)
      return false unless rules["approval"] == "manual"

      limit = rules["approval_within_minutes"]
      limit.nil? || starts.min < now + limit.minutes
    end

    def day_total(form, zone, day)
      start = zone.local(day.year, day.month, day.day)
      AppointmentSlot.where(form_id: form.id, starts_at: start.utc..start.end_of_day.utc).sum(:booked)
    end

    def valid_zone(value)
      value if value.is_a?(String) && TZInfo::Timezone.all_identifiers.include?(value)
    end

    def valid_locale(value)
      value if LOCALES.include?(value)
    end

    private

    def reserve(form, booking, item, held)
      service = booking["services"].find { |entry| entry["id"] == item["service"] }
      lengths = item["starts_at"].zip(item["durations"]).to_h { |time, minutes| [time.to_i, minutes] }
      starts = item["starts_at"].uniq.sort
      ids = Reserve.call(
        form: form,
        service_key: item["service"],
        resource_key: Resource.key(service),
        capacity: item["capacity"],
        times: starts,
        held: held,
        durations: lengths,
      )
      {
        service: service,
        starts: starts,
        lengths: lengths,
        slot_ids: starts.zip(ids).to_h,
        durations: item["durations"],
        monthly: item["monthly"],
      }
    end

    def total_of(entry)
      service = entry[:service]
      monthly_price = service.dig("monthly", "price")
      return BigDecimal(monthly_price.to_s) if entry[:monthly] && monthly_price && service["currency"]

      Pricing.call(service: service, durations: entry[:durations])&.fetch(:total)&.then { |amount| BigDecimal(amount.to_s) }
    end

    def hold_daily_limit(form, rules, items)
      limit = rules["max_per_day"]
      return unless limit

      zone = Time.find_zone!(rules["time_zone"])
      items.flat_map { |item| item["starts_at"] }.group_by { |time| time.in_time_zone(zone).to_date }.sort.each do |day, times|
        AppointmentSlot.connection.execute(AppointmentSlot.sanitize_sql_array(["SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", "max_per_day:#{form.id}:#{day.iso8601}"]))
        raise Full, times.min if day_total(form, zone, day) + times.size > limit
      end
    end
  end
end
