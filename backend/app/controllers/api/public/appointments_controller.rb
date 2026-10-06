class Api::Public::AppointmentsController < ApplicationController
  include ClientIp

  rate_limit to: 60,
    within: 1.minute,
    only: :show,
    name: "public_appointment_show",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  rate_limit to: 20,
    within: 1.minute,
    only: :cancel,
    name: "public_appointment_cancel",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  before_action :load_appointment

  def show
    render(json: payload, status: :ok)
  end

  def cancel
    Appointments::ClientCancel.call(appointment: @appointment, reason: params[:reason])
    render(json: payload, status: :ok)
  end

  private

  def load_appointment
    @appointment = AppointmentToken.resolve(params[:token])
    not_found unless @appointment && Appointments::Config.enabled_for?(@appointment.form.user)
  end

  def not_found
    render(json: { error: "not_found" }, status: :not_found)
  end

  def payload
    rows = Appointment.where(group_key: @appointment.group_key).includes(:slot).order("appointment_slots.starts_at").references(:slot).to_a
    first = rows.first
    {
      appointment: {
        form_title: @appointment.form.title,
        service: first.snapshot["name"],
        status: (Appointment::HOLDING & rows.map(&:status)).min_by { |status| status == "confirmed" ? 0 : 1 } || "cancelled",
        cancellable: rows.any? { |row| Appointment::HOLDING.include?(row.status) && row.slot.starts_at > Time.current },
        time_zone: Appointments::Book.valid_zone(first.client_time_zone) || "UTC",
        sessions: rows.map { |row| { starts_at: row.slot.starts_at.iso8601, status: row.status } },
      },
    }
  end
end
