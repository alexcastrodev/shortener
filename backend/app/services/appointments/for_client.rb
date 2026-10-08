module Appointments
  module ForClient
    extend self

    LIMIT = 50
    RANGE_LIMIT = 200
    UUID = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

    def list(user, from: nil, to: nil)
      scope = live(user.email)
      keys = from ? keys_between(scope, user, from, to) : scope.group(:group_key).order(Arel.sql("MIN(created_at) DESC, group_key DESC")).limit(LIMIT).pluck(:group_key)
      groups = scope.where(group_key: keys).includes(:slot, :form).order("appointment_slots.starts_at", :id).references(:slot).group_by(&:group_key)
      items = keys.map do |key|
        rows = groups.fetch(key)
        { group_key: key, form_title: rows.first.form.title, **summary(rows, time_zone: user.time_zone) }
      end
      from ? items.sort_by { |item| [item[:sessions].first[:starts_at], item[:group_key]] } : items
    end

    def manage_url(user, group_key)
      return unless group_key.to_s.match?(UUID)

      rows = live(user.email).where(group_key: group_key).includes(:slot).to_a
      return if rows.empty?

      Book.manage_url(rows.min_by(&:id), rows.map { |row| row.slot.starts_at }.max)
    end

    def summary(rows, time_zone: nil)
      first = rows.first
      {
        service: first.snapshot["name"],
        status: (Appointment::HOLDING & rows.map(&:status)).min_by { |status| status == "confirmed" ? 0 : 1 } || "cancelled",
        cancellable: rows.any? { |row| Appointment::HOLDING.include?(row.status) && row.slot.starts_at > Time.current },
        time_zone: Book.valid_zone(first.client_time_zone) || Book.valid_zone(time_zone) || "UTC",
        series: first.snapshot["monthly"].present?,
        sessions: rows.map { |row| { starts_at: row.slot.starts_at.iso8601, status: row.status } },
      }
    end

    private

    def keys_between(scope, user, from, to)
      zone = Time.find_zone!(user.time_zone)
      range = zone.local(from.year, from.month, from.day).utc..zone.local(to.year, to.month, to.day).end_of_day.utc
      scope.joins(:slot).where(appointment_slots: { starts_at: range }).group(:group_key).order(Arel.sql("MIN(appointment_slots.starts_at), group_key")).limit(RANGE_LIMIT).pluck(:group_key)
    end

    def live(email)
      Appointment.where("lower(client_email) = ?", email.to_s.downcase).where.not(status: "rescheduled")
    end
  end
end
