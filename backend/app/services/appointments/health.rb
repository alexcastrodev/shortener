module Appointments
  module Health
    extend self

    OVERDUE_ALERT = 5.minutes.to_i
    QUEUE_LAG_ALERT = 5.minutes.to_i
    BUDGET_ALERT_PERCENT = 80
    DENIAL_CODES = ["insufficient_scope"].freeze
    APPOINTMENT_TOOLS = ["get_booking_config", "preview_availability", "generate_time_slots", "list_appointments", "get_appointment", "get_agenda", "list_notifications", "mark_notification_read", "update_booking_config", "apply_time_slots", "get_booking_impact"].freeze

    def call(now: Time.current)
      metrics = {
        pending_overdue: overdue(now),
        notifications: notifications(now),
        queue: { notifications_lag_seconds: queue_lag(now) },
        mail_budget: budget,
        mcp_denials_last_day: denials(now),
      }
      metrics.merge(alerts: alerts(metrics))
    end

    private

    def overdue(now)
      scope = Appointment.where(status: "pending").where(expires_at: ..now)
      oldest = scope.minimum(:expires_at)
      { count: scope.distinct.count(:group_key), oldest_seconds: oldest ? (now - oldest).to_i : 0 }
    end

    def notifications(now)
      due = Notification.where(status: "pending").where(next_attempt_at: ..now)
      recent = Notification.where(status: "failed", created_at: (now - 1.day)..)
      {
        email_pending: due.where(channel: "email").count,
        email_oldest_pending_seconds: age(due.where(channel: "email").minimum(:created_at), now),
        push_pending: due.where(channel: "push").count,
        email_failed_last_day: recent.where(channel: "email").count,
        push_failed_last_day: recent.where(channel: "push").count,
      }
    end

    def queue_lag(now)
      age(SolidQueue::ReadyExecution.where(queue_name: "notifications").minimum(:created_at), now)
    end

    def budget
      used = MailBudget.usage[:day]
      limit = MailBudget.daily_limit
      { day_used: used, day_limit: limit, day_percent: limit.positive? ? (used * 100.0 / limit).round(1) : 0 }
    end

    def denials(now)
      McpToolCall.where(tool: APPOINTMENT_TOOLS, error_code: DENIAL_CODES, created_at: (now - 1.day)..).group(:tool).count
    end

    def age(time, now)
      time ? (now - time).to_i : 0
    end

    def alerts(metrics)
      list = []
      list << "pending_overdue" if metrics[:pending_overdue][:oldest_seconds] > OVERDUE_ALERT
      list << "notification_queue_lag" if metrics[:queue][:notifications_lag_seconds] > QUEUE_LAG_ALERT
      list << "email_budget" if metrics[:mail_budget][:day_percent] >= BUDGET_ALERT_PERCENT
      list << "notifications_failed" if metrics[:notifications][:email_failed_last_day].positive? || metrics[:notifications][:push_failed_last_day].positive?
      list
    end
  end
end
