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
    scope = Appointments::ClientCancel::SCOPES.include?(params[:scope].to_s) ? params[:scope].to_s : "all"
    target = scope == "all" ? @appointment : session_row(params[:session])
    return render(json: { error: "unknown_session" }, status: :unprocessable_content) unless target

    Appointments::ClientCancel.call(appointment: target, reason: params[:reason], scope: scope)
    render(json: payload, status: :ok)
  end

  private

  def load_appointment
    @appointment = AppointmentToken.resolve(params[:token])
    not_found unless @appointment
  end

  def session_row(value)
    time = Time.iso8601(value.to_s)
    Appointment.where(group_key: @appointment.group_key).includes(:slot).references(:slot).find_by(appointment_slots: { starts_at: time })
  rescue ArgumentError
    nil
  end

  def not_found
    render(json: { error: "not_found" }, status: :not_found)
  end

  def payload
    rows = Appointment.where(group_key: @appointment.group_key).where.not(status: "rescheduled").includes(:slot).order("appointment_slots.starts_at").references(:slot).to_a
    { appointment: { form_title: @appointment.form.title, **Appointments::ForClient.summary(rows) } }
  end
end
