module Appointments
  module Agenda
    extend self

    MAX_RANGE_DAYS = Slots::MAX_RANGE_DAYS
    OPEN_RULES = { "min_notice_minutes" => 0, "window_days" => 36_500, "buffer_minutes" => 0, "max_per_day" => nil }.freeze

    def call(user:, from:, to:, now: Time.current)
      zone = Time.find_zone!(user.time_zone)
      range = zone.local(from.year, from.month, from.day).utc..zone.local(to.year, to.month, to.day).end_of_day.utc
      forms = user.forms.where("fields @> ?", [{ type: "booking" }].to_json).index_by(&:id)
      return [] if forms.empty?

      sessions = stored(forms, range, zone)
      derived(forms.values, from, to, now, zone).each { |key, session| sessions[key] ||= session }
      sessions.values.sort_by { |session| [session[:starts_at], session[:form_id]] }
    end

    private

    def stored(forms, range, zone)
      AppointmentSlot.where(form_id: forms.keys, starts_at: range).includes(:appointments).to_h do |slot|
        appointments = slot.appointments.sort_by(&:id)
        name = appointments.first&.snapshot&.dig("name")
        [key(slot.form_id, slot.service_key, slot.starts_at), session(forms[slot.form_id], zone, { service_id: slot.service_key, name: name, starts_at: slot.starts_at, capacity: slot.capacity, booked: slot.booked, appointments: appointments })]
      end
    end

    def derived(forms, from, to, now, zone)
      today = now.in_time_zone(zone).to_date
      start = [from, today].max
      return {} if start > to

      forms.select(&:published).each_with_object({}) do |form, result|
        booking = Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" }
        next unless booking

        rules = booking["rules"].merge(OPEN_RULES)
        booking["services"].each do |service|
          Slots.call(service: service, rules: rules, from: start, to: [to, start + (MAX_RANGE_DAYS - 1)].min, now: now).each do |slot|
            result[key(form.id, service["id"], slot[:starts_at])] = session(form, zone, { service_id: service["id"], name: service["name"], starts_at: slot[:starts_at], capacity: service["capacity"], booked: 0, appointments: [] })
          end
        end
      end
    end

    def key(form_id, service_id, starts_at)
      [form_id, service_id, starts_at.to_i]
    end

    def session(form, zone, data)
      appointments = data[:appointments]
      {
        form_id: form.id,
        form_title: form.title,
        service_id: data[:service_id],
        service_name: data[:name],
        starts_at: data[:starts_at].utc,
        date: data[:starts_at].in_time_zone(zone).to_date,
        capacity: data[:capacity],
        booked: data[:booked],
        pending: appointments.count { |appointment| appointment.status == "pending" },
        appointments: appointments.select { |appointment| Appointment::HOLDING.include?(appointment.status) },
      }
    end
  end
end
