module Appointments
  module Search
    extend self

    STATUSES = ["pending", "confirmed", "cancelled", "declined", "expired", "rescheduled"].freeze
    MAX_EXPORT = 50_000

    def call(form:, status: nil, query: nil, from: nil, to: nil, zone: Time.zone)
      scope = Appointment.where(form_id: form.id).joins(:slot).includes(:slot)
      scope = scope.where(status: status) if STATUSES.include?(status)
      scope = scope.where(appointment_slots: { starts_at: zone.local(from.year, from.month, from.day).utc.. }) if from
      scope = scope.where(appointment_slots: { starts_at: ..zone.local(to.year, to.month, to.day).end_of_day.utc }) if to
      scope = scope.where("appointments.client_name ILIKE :q OR appointments.client_email ILIKE :q", q: "%#{Appointment.sanitize_sql_like(query.to_s.strip.first(100))}%") if query.present?
      scope
    end

    def row(appointment)
      {
        id: appointment.id,
        status: appointment.status,
        starts_at: appointment.slot.starts_at.utc.iso8601,
        service_name: appointment.snapshot["name"],
        client_name: appointment.client_name,
        client_email: appointment.client_email,
        group_key: appointment.group_key,
        cancel_reason: appointment.cancel_reason,
        created_at: appointment.created_at.utc.iso8601,
      }
    end

    def safe_cell(value)
      text = value.to_s
      text.match?(/\A[=+\-@\t\r]/) ? "'#{text}" : text
    end

    def csv(rows)
      header = ["Starts at", "Service", "Name", "Email", "Status", "Booked at", "Reason"]
      lines = [header, *rows.map { |item| [item[:starts_at], item[:service_name], item[:client_name], item[:client_email], item[:status], item[:created_at], item[:cancel_reason]] }]
      "﻿#{lines.map { |line| line.map { |cell| "\"#{safe_cell(cell).gsub('"', '""')}\"" }.join(",") }.join("\r\n")}\r\n"
    end
  end
end
