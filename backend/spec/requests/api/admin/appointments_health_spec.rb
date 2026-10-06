require "rails_helper"

RSpec.describe("/api/admin/appointments_health and its alerts", type: :request) do
  include_context "authenticated user"

  let(:now) { Time.utc(2026, 11, 2, 12, 0) }
  let(:form) { Form.create!(user: current_user, title: "Salon") }

  before do
    host! "localhost"
    travel_to(now)
    Rails.cache.clear
  end

  def json = JSON.parse(response.body)

  def health
    get("/api/admin/appointments_health", headers: admin_auth_headers)
    json
  end

  def pending(expires_at:)
    slot = AppointmentSlot.create!(form: form, service_key: "svc00001", starts_at: now + 3.days + rand(1..10_000).minutes, capacity: 1, booked: 1)
    Appointment.create!(form: form, response: FormResponse.create!(form: form, answers: {}), slot: slot, group_key: SecureRandom.uuid, status: "pending", expires_at: expires_at, snapshot: {})
  end

  describe "access" do
    it "answers 401 without a token and 403 for a user who is not an admin" do
      get("/api/admin/appointments_health")
      expect(response).to(have_http_status(:unauthorized))
      get("/api/admin/appointments_health", headers: auth_headers)
      expect(response).to(have_http_status(:forbidden))
    end
  end

  describe "the numbers" do
    it "is all zero and without alerts when nothing is waiting" do
      report = health
      expect(report["pending_overdue"]).to(eq("count" => 0, "oldest_seconds" => 0))
      expect(report["notifications"].values).to(all(eq(0)))
      expect(report["queue"]).to(eq("notifications_lag_seconds" => 0))
      expect(report["mcp_denials_last_day"]).to(eq({}))
      expect(report["alerts"]).to(eq([]))
    end

    it "measures how late the oldest overdue request is, counting bookings and not sessions" do
      group = SecureRandom.uuid
      2.times { pending(expires_at: now - 2.minutes).update!(group_key: group) }
      pending(expires_at: now - 90.seconds)
      pending(expires_at: now + 1.hour)
      expect(health["pending_overdue"]).to(eq("count" => 2, "oldest_seconds" => 120))
      expect(health["alerts"]).not_to(include("pending_overdue"))
    end

    it "alerts when a request has been overdue for more than five minutes" do
      pending(expires_at: now - 6.minutes)
      expect(health["alerts"]).to(include("pending_overdue"))
    end

    it "counts the notifications waiting to go out and the ones that failed in the last day" do
      Notification.create!(channel: "email", kind: "appointment_created", recipient_kind: "client", recipient_email: "a@example.com", event_key: "a", payload: {}, status: "pending", next_attempt_at: now - 1.minute, created_at: now - 10.minutes)
      Notification.create!(channel: "email", kind: "appointment_created", recipient_kind: "client", recipient_email: "b@example.com", event_key: "b", payload: {}, status: "pending", next_attempt_at: now + 1.hour)
      Notification.create!(channel: "push", kind: "appointment_created", recipient_kind: "owner", user_id: current_user.id, event_key: "c", payload: {}, status: "pending", next_attempt_at: now)
      Notification.create!(channel: "email", kind: "appointment_created", recipient_kind: "client", recipient_email: "d@example.com", event_key: "d", payload: {}, status: "failed", created_at: now - 2.hours)
      Notification.create!(channel: "push", kind: "appointment_created", recipient_kind: "owner", user_id: current_user.id, event_key: "e", payload: {}, status: "failed", created_at: now - 3.days)
      expect(health["notifications"]).to(eq(
        "email_pending" => 1, "email_oldest_pending_seconds" => 600, "push_pending" => 1, "email_failed_last_day" => 1, "push_failed_last_day" => 0,
      ))
      expect(health["alerts"]).to(eq(["notifications_failed"]))
    end

    it "reports how late the notification queue is" do
      SolidQueue::Job.create!(queue_name: "notifications", class_name: "NotificationDeliveryJob", arguments: "[]", priority: 0)
      SolidQueue::ReadyExecution.update_all(created_at: now - 7.minutes)
      report = health
      expect(report["queue"]["notifications_lag_seconds"]).to(eq(420))
      expect(report["alerts"]).to(include("notification_queue_lag"))
    end

    it "shows how much of the day's email budget is used and alerts from 80 percent" do
      allow(MailBudget).to(receive_messages(usage: { day: 79, month: 0, new_addresses: 0 }, daily_limit: 100))
      expect(health["mail_budget"]).to(eq("day_used" => 79, "day_limit" => 100, "day_percent" => 79.0))
      expect(json["alerts"]).not_to(include("email_budget"))

      allow(MailBudget).to(receive(:usage).and_return({ day: 80, month: 0, new_addresses: 0 }))
      expect(health["alerts"]).to(include("email_budget"))
    end

    it "counts how often each appointment tool was refused for lack of scope in the last day" do
      grant = OauthGrant.create!(user: current_user, oauth_client: OauthClient.create!(client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]), scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp")
      2.times { McpToolCall.create!(oauth_grant: grant, tool: "list_appointments", status: "error", error_code: "insufficient_scope", records_returned: 0, duration_ms: 1) }
      McpToolCall.create!(oauth_grant: grant, tool: "get_agenda", status: "error", error_code: "insufficient_scope", records_returned: 0, duration_ms: 1)
      McpToolCall.create!(oauth_grant: grant, tool: "list_forms", status: "error", error_code: "insufficient_scope", records_returned: 0, duration_ms: 1)
      McpToolCall.create!(oauth_grant: grant, tool: "get_agenda", status: "error", error_code: "insufficient_scope", records_returned: 0, duration_ms: 1, created_at: now - 3.days)
      expect(health["mcp_denials_last_day"]).to(eq("list_appointments" => 2, "get_agenda" => 1))
    end
  end

  describe AppointmentsHealthJob do
    it "writes one log line and reports each alert to Sentry once, until the hour is over" do
      pending(expires_at: now - 10.minutes)
      allow(Sentry).to(receive(:capture_message))
      allow(Rails.logger).to(receive(:info))

      described_class.perform_now
      described_class.perform_now

      expect(Sentry).to(have_received(:capture_message).with("Appointments: pending_overdue", hash_including(level: :warning)).once)
      expect(Rails.logger).to(have_received(:info).with(a_string_including("[appointments] health", "alerts=pending_overdue")).twice)

      Rails.cache.delete("appointments:health:alerted:pending_overdue")
      described_class.perform_now
      expect(Sentry).to(have_received(:capture_message).twice)
    end

    it "stays quiet when nothing is wrong" do
      allow(Sentry).to(receive(:capture_message))
      described_class.perform_now
      expect(Sentry).not_to(have_received(:capture_message))
    end

    it "is scheduled every five minutes" do
      schedule = YAML.safe_load(ERB.new(Rails.root.join("config/recurring.yml").read).result)["production"]
      expect(schedule["appointments_health"]).to(include("class" => "AppointmentsHealthJob", "schedule" => "every 5 minutes"))
    end
  end
end
