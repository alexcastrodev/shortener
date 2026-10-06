class Api::Me::AppointmentsController < ApplicationController
  before_action :authenticate_user!
  include AppointmentsGate
  before_action :load_appointment

  def reschedule
    result = Appointments::Reschedule.call(row: @appointment, date: params[:date], time: params[:time], message: params[:message])
    case result.status
    when :ok then render(json: { appointment: Appointments::Search.row(result.record) }, status: :ok)
    when :same_time then render(json: { error: "same_time" }, status: :unprocessable_entity)
    when :unavailable then render(json: { error: "unavailable" }, status: :conflict)
    else render(json: { error: "not_reschedulable" }, status: :unprocessable_entity)
    end
  end

  def remind
    case Appointments::RemindNow.call(row: @appointment)
    when :ok then render(json: { ok: true }, status: :accepted)
    when :too_soon then render(json: { error: "too_soon" }, status: :too_many_requests)
    when :no_email then render(json: { error: "no_email" }, status: :unprocessable_entity)
    else render(json: { error: "nothing_to_remind" }, status: :unprocessable_entity)
    end
  end

  private

  def load_appointment
    @appointment = Appointment.where(form_id: current_user.forms.select(:id)).find(params[:id])
  end
end
