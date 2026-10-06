class Api::Public::AppointmentVerificationsController < ApplicationController
  include ClientIp

  rate_limit to: 60,
    within: 1.minute,
    only: :show,
    name: "public_verification_show",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  rate_limit to: 20,
    within: 1.minute,
    only: :create,
    name: "public_verification_create",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  before_action :load_appointment

  def show
    render(json: payload, status: :ok)
  end

  def create
    render(json: payload.merge(result: Appointments::Verify.call(appointment: @appointment)), status: :ok)
  end

  private

  def load_appointment
    @appointment = AppointmentToken.resolve(params[:token], purpose: "verify")
    render(json: { error: "not_found" }, status: :not_found) unless @appointment && Appointments::Config.enabled_for?(@appointment.form.user)
  end

  def payload
    rows = Appointment.where(group_key: @appointment.group_key).includes(:slot).order("appointment_slots.starts_at").references(:slot).to_a
    zone = Appointments::Book.valid_zone(rows.first.client_time_zone) || "UTC"
    {
      appointment: {
        form_title: @appointment.form.title,
        service: rows.first.snapshot["name"],
        status: rows.first.status,
        expires_at: rows.first.expires_at&.iso8601,
        time_zone: zone,
        sessions: rows.map { |row| { starts_at: row.slot.starts_at.iso8601 } },
      },
    }
  end
end
