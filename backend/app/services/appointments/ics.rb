module Appointments
  module Ics
    extend self

    PAST_DAYS = 30
    FUTURE_DAYS = 365
    LIMIT = 2_000

    def call(user:, now: Time.current)
      rows = Appointment.where(status: "confirmed", form_id: user.forms.select(:id))
        .joins(:slot).merge(AppointmentSlot.where(starts_at: (now - PAST_DAYS.days)..(now + FUTURE_DAYS.days)))
        .includes(:slot, :form).order("appointment_slots.starts_at", :id).limit(LIMIT)
      lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kurz//Appointments//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Kurz"]
      rows.each { |row| lines.concat(event(row, now)) }
      lines << "END:VCALENDAR"
      "#{lines.flat_map { |line| fold(line) }.join("\r\n")}\r\n"
    end

    def escape(value)
      value.to_s.gsub(/[\u0000-\u0008\u000B-\u001F\u007F]/, "").gsub(/\r\n|\r|\n/, " ").gsub(/[\\;,]/) { |char| "\\#{char}" }
    end

    def fold(line)
      chunks = []
      current = +""
      line.each_char do |char|
        if current.bytesize + char.bytesize > (chunks.empty? ? 75 : 74)
          chunks << current
          current = +""
        end
        current << char
      end
      chunks << current
      chunks.each_with_index.map { |chunk, index| index.zero? ? chunk : " #{chunk}" }
    end

    private

    def event(row, now)
      starts = row.slot.starts_at.utc
      minutes = row.snapshot["duration"].to_i.positive? ? row.snapshot["duration"].to_i : 30
      [
        "BEGIN:VEVENT",
        "UID:appointment-#{row.id}@kurz.fyi",
        "DTSTAMP:#{now.utc.strftime("%Y%m%dT%H%M%SZ")}",
        "DTSTART:#{starts.strftime("%Y%m%dT%H%M%SZ")}",
        "DTEND:#{(starts + minutes.minutes).strftime("%Y%m%dT%H%M%SZ")}",
        "SUMMARY:#{escape([row.snapshot["name"], row.client_name].compact_blank.join(" · "))}",
        "DESCRIPTION:#{escape(row.form.title)}",
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ]
    end
  end
end
