module Appointments
  module Reschedule
    extend self

    MESSAGE_MAX = 500
    Result = Data.define(:status, :record)

    def call(row:, date:, time:, message: nil, now: Time.current, force: false)
      form = row.form
      booking = Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" }
      service = booking&.fetch("services", [])&.find { |item| item["id"] == row.slot.service_key }
      return Result.new(:invalid, nil) unless service && Appointment::HOLDING.include?(row.status) && row.slot.starts_at > now

      context = { form: form, booking: booking, service: service, now: now }
      return Result.new(:same_time, nil) if same_time?(context, row, date, time)

      target = force ? any_slot(context, date, time, now) : free_slot(context, date, time)
      return Result.new(:unavailable, nil) unless target

      moved = nil
      Appointment.transaction do
        old = Appointment.lock.find(row.id)
        next unless Appointment::HOLDING.include?(old.status)

        slot_id = Reserve.call(form: form, service_key: service["id"], capacity: service["capacity"], times: [target[:starts_at]]).first
        Release.call([old.slot_id])
        attributes = copy(old).merge(slot_id: slot_id, rescheduled_from_id: old.id, decision_message: message.to_s.strip.first(MESSAGE_MAX).presence)
        old.update!(status: "rescheduled", decided_at: now)
        moved = Appointment.create!(attributes)
        notify(moved, old)
      end
      moved ? Result.new(:ok, moved) : Result.new(:invalid, nil)
    rescue Reserve::Full
      Result.new(:unavailable, nil)
    end

    private

    def free_slot(context, date, time)
      day = Date.iso8601(date.to_s)
      booking = context[:booking]
      open_rules = booking.merge("rules" => booking["rules"].merge("min_notice_minutes" => 0))
      FreeSlots.call(form: context[:form], booking: open_rules, service: context[:service], from: day, to: day, now: context[:now]).find { |slot| slot[:time] == time.to_s }
    rescue Date::Error
      nil
    end

    def any_slot(context, date, time, now)
      starts_at = local_time(context, date, time)
      starts_at && starts_at > now ? { starts_at: starts_at } : nil
    rescue Date::Error
      nil
    end

    def local_time(context, date, time)
      day = Date.iso8601(date.to_s)
      hours, minutes = time.to_s.split(":").map(&:to_i)
      return unless time.to_s.match?(/\A([01]\d|2[0-3]):[0-5]\d\z/)

      Time.find_zone!(context[:booking]["rules"]["time_zone"]).local(day.year, day.month, day.day, hours, minutes).utc
    end

    def same_time?(context, row, date, time)
      local_time(context, date, time) == row.slot.starts_at
    rescue Date::Error
      false
    end

    def copy(old)
      old.attributes.slice("form_id", "response_id", "group_key", "status", "expires_at", "client_name", "client_email", "client_phone", "snapshot", "published_version", "client_time_zone", "client_locale", "decided_by").merge("created_at" => Time.current)
    end

    def notify(moved, old)
      return if moved.client_email.blank?

      payload = { form_id: moved.form_id, response_id: moved.response_id, group_key: moved.group_key, from: old.slot.starts_at.utc.iso8601 }
      queued = Notification.queue_email(kind: "appointment_rescheduled", event_key: "#{moved.group_key}:r#{moved.id}", source: moved, recipient_kind: "client", recipient_email: moved.client_email, payload: payload)
      ActiveRecord.after_all_transactions_commit { NotificationDeliveryJob.perform_later(queued.id) }
    end
  end
end
