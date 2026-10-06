class Api::Public::AppointmentDecisionsController < ApplicationController
  include ClientIp

  rate_limit to: 60,
    within: 1.minute,
    only: :show,
    name: "public_decision_show",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  rate_limit to: 20,
    within: 1.minute,
    only: :create,
    name: "public_decision_create",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  before_action :load_appointment

  def show
    render(json: payload, status: :ok)
  end

  def create
    outcome = Appointments::Decide.call(appointment: @appointment, decision: params[:decision].to_s, message: params[:message])
    return render(json: { error: "invalid_decision" }, status: :unprocessable_entity) if outcome == :invalid

    render(json: payload.merge(result: outcome), status: :ok)
  end

  private

  def load_appointment
    @appointment = AppointmentToken.resolve(params[:token], purpose: "decide")
    render(json: { error: "not_found" }, status: :not_found) unless @appointment
  end

  def payload
    rows = Appointment.where(group_key: @appointment.group_key).includes(:slot).order("appointment_slots.starts_at").references(:slot).to_a
    owner = @appointment.form.user
    zone = owner.time_zone.presence || "UTC"
    {
      appointment: {
        form_title: @appointment.form.title,
        service: rows.first.snapshot["name"],
        client_name: rows.first.client_name,
        client_email: rows.first.client_email,
        status: rows.first.status,
        expires_at: rows.first.expires_at&.iso8601,
        time_zone: zone,
        sessions: rows.map { |row| { starts_at: row.slot.starts_at.iso8601 } },
      },
    }
  end
end
