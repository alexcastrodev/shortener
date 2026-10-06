module Appointments
  module Waitlist
    extend self

    MAX_WAITING = 20
    MAX_PER_EMAIL = 5
    DEFAULT_CONFIRM_MINUTES = 120
    CONFIRM_RANGE = (15..4_320)
    NAME_MAX = 100

    Joined = Data.define(:status, :entry)

    def enabled?(booking)
      booking.dig("rules", "waitlist") == true
    end

    def confirm_minutes(booking)
      booking.dig("rules", "waitlist_confirm_minutes") || DEFAULT_CONFIRM_MINUTES
    end

    def booking_of(form)
      Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" }
    end

    def join(form:, service_id:, date:, time:, name:, email:, locale: nil, zone: nil, now: Time.current)
      booking = booking_of(form)
      service = booking&.fetch("services", [])&.find { |item| item["id"] == service_id }
      return Joined.new(:unavailable, nil) unless booking && service && enabled?(booking) && service["capacity"]

      clean_name = name.to_s.gsub(/[[:cntrl:]]+/, " ").strip.first(NAME_MAX)
      clean_email = email.to_s.strip
      return Joined.new(:invalid, nil) if clean_name.blank? || !plausible_email?(clean_email)

      starts_at = offered_start(booking, service, date, time, now)
      return Joined.new(:unavailable, nil) unless starts_at

      slot = AppointmentSlot.find_by(form_id: form.id, service_key: service_id, starts_at: starts_at)
      return Joined.new(:not_full, nil) unless slot&.capacity && slot.booked + slot.held >= slot.capacity

      create_entry(form, [service_id, starts_at], { name: clean_name, email: clean_email, locale: locale, zone: zone })
    end

    def offer_for(slot_ids, now: Time.current)
      return unless WaitlistEntry.where(status: "waiting").exists?

      AppointmentSlot.where(id: slot_ids).find_each { |slot| offer_slot(slot, now) }
    end

    def claim(entry, now: Time.current)
      entry.with_lock do
        return :not_offered unless entry.status == "offered"
        return :expired if entry.offered_until <= now

        form = entry.form
        booking = booking_of(form)
        return give_up(entry, now) unless booking && enabled?(booking)

        result = submit(form, booking, entry, now)
        return give_up(entry, now) if result.errors

        entry.update!(status: "claimed")
        :claimed
      rescue Book::Full
        give_up(entry, now)
      end
    end

    def leave(entry, now: Time.current)
      slot_id = nil
      entry.with_lock do
        return :already_closed unless entry.active?

        slot_id = release_hold(entry) if entry.status == "offered"
        entry.update!(status: "left")
      end
      offer_for([slot_id].compact, now: now)
      :left
    end

    def sweep(now: Time.current)
      slots = []
      WaitlistEntry.where(status: "offered", offered_until: ..now).or(WaitlistEntry.where(status: ["waiting", "offered"], starts_at: ..now)).find_each do |entry|
        entry.with_lock do
          next unless entry.active? && (entry.starts_at <= now || (entry.status == "offered" && entry.offered_until <= now))

          held = entry.status == "offered"
          slots << release_hold(entry) if held
          entry.update!(status: "expired")
        end
      end
      offer_for(slots.compact.uniq, now: now)
      slots.size
    end

    private

    def plausible_email?(value)
      return false unless value.length.between?(3, Forms::FieldSchema::EMAIL_MAX) && value.count("@") == 1 && !value.match?(/[[:space:][:cntrl:]]/)

      local, domain = value.split("@", 2)
      local.present? && domain.to_s.include?(".") && !domain.start_with?(".") && !domain.end_with?(".")
    end

    def offered_start(booking, service, date, time, now)
      return unless date.to_s.match?(Book::DATE) && time.to_s.match?(Book::TIME)

      day = Date.iso8601(date)
      offered = Slots.call(service: service, rules: booking["rules"], from: day, to: day, now: now, exceptions: booking["exceptions"].to_a)
      offered.find { |slot| slot[:date] == day && slot[:time] == time }&.fetch(:starts_at)
    rescue Date::Error
      nil
    end

    def create_entry(form, key, person)
      service_id, starts_at = key
      email = person[:email]
      existing = WaitlistEntry.active.find_by(form_id: form.id, service_key: service_id, starts_at: starts_at, email: email)
      return Joined.new(:ok, existing) if existing
      return Joined.new(:list_full, nil) if WaitlistEntry.where(form_id: form.id, service_key: service_id, starts_at: starts_at, status: "waiting").count >= MAX_WAITING
      return Joined.new(:too_many, nil) if WaitlistEntry.active.where(form_id: form.id).where("lower(email) = ?", email.downcase).count >= MAX_PER_EMAIL

      entry = WaitlistEntry.create!(form: form, service_key: service_id, starts_at: starts_at, name: person[:name], email: email, locale: Book.valid_locale(person[:locale]), time_zone: Book.valid_zone(person[:zone]), status: "waiting")
      Mailing.joined(entry)
      Joined.new(:ok, entry)
    rescue ActiveRecord::RecordNotUnique
      Joined.new(:ok, WaitlistEntry.active.find_by(form_id: form.id, service_key: service_id, starts_at: starts_at, email: email))
    end

    def offer_slot(slot, now)
      loop do
        entry = WaitlistEntry.where(form_id: slot.form_id, service_key: slot.service_key, starts_at: slot.starts_at, status: "waiting").where("starts_at > ?", now).order(:id).first
        break unless entry

        taken = AppointmentSlot.where(id: slot.id).where("capacity IS NULL OR booked + held < capacity").update_all("held = held + 1, updated_at = NOW()")
        break if taken.zero?

        booking = booking_of(entry.form)
        until_at = [now + (booking ? confirm_minutes(booking) : DEFAULT_CONFIRM_MINUTES).minutes, entry.starts_at].min
        entry.update!(status: "offered", offered_until: until_at)
        Mailing.offered(entry)
      end
    end

    def release_hold(entry)
      slot = AppointmentSlot.find_by(form_id: entry.form_id, service_key: entry.service_key, starts_at: entry.starts_at)
      slot&.then { |row| AppointmentSlot.where(id: row.id).where("held > 0").update_all("held = held - 1, updated_at = NOW()") }
      slot&.id
    end

    def give_up(entry, now)
      slot_id = release_hold(entry)
      entry.update!(status: "expired")
      offer_for([slot_id].compact, now: now)
      :unavailable
    end

    def submit(form, booking, entry, now)
      zone = Time.find_zone!(booking["rules"]["time_zone"])
      local = entry.starts_at.in_time_zone(zone)
      fields = Forms::PublicDefinition.for(form).fields
      name_id = fields.find { |field| field["type"] == "short_text" && field["required"] }&.fetch("id")
      mail_id = fields.find { |field| field["type"] == "email" && field["required"] }&.fetch("id")
      answers = { name_id => entry.name, mail_id => entry.email, booking["id"] => { "service" => entry.service_key, "sessions" => [{ "date" => local.to_date.iso8601, "time" => local.strftime("%H:%M") }] } }
      Forms::SubmitResponse.call(form: form, answers: answers, client: { time_zone: entry.time_zone, locale: entry.locale }, claim_at: entry.starts_at)
    end

    module Mailing
      extend self

      def joined(entry) = deliver(entry, :joined)

      def offered(entry) = deliver(entry, :offered)

      private

      def deliver(entry, kind)
        return unless MailBudget.reserve(new_address: false, share: 0.8).ok?

        WaitlistMailer.with(entry: entry).public_send(kind).deliver_later
      end
    end
  end
end
