class Api::Me::AppointmentsController < ApplicationController
  before_action :authenticate_user!
  before_action :load_appointment

  def approve
    decide("approve")
  end

  def decline
    decide("decline")
  end

  def cancel
    cancelled = Appointments::ClientCancel.call(appointment: @appointment, reason: params[:reason], by: "owner", scope: cancel_scope)
    return render(json: { error: "nothing_to_cancel" }, status: :unprocessable_content) if cancelled.empty?

    render(json: { appointments: group_rows }, status: :ok)
  end

  def reschedule
    result = Appointments::Reschedule.call(row: @appointment, date: params[:date], time: params[:time], message: params[:message], force: ActiveModel::Type::Boolean.new.cast(params[:force]) == true)
    case result.status
    when :ok then render(json: { appointment: Appointments::Search.row(result.record) }, status: :ok)
    when :same_time then render(json: { error: "same_time" }, status: :unprocessable_content)
    when :unavailable then render(json: { error: "unavailable" }, status: :conflict)
    else render(json: { error: "not_reschedulable" }, status: :unprocessable_content)
    end
  end

  def remind
    case Appointments::RemindNow.call(row: @appointment)
    when :ok then render(json: { ok: true }, status: :accepted)
    when :too_soon then render(json: { error: "too_soon" }, status: :too_many_requests)
    when :no_email then render(json: { error: "no_email" }, status: :unprocessable_content)
    else render(json: { error: "nothing_to_remind" }, status: :unprocessable_content)
    end
  end

  private

  def cancel_scope
    Appointments::ClientCancel::SCOPES.include?(params[:scope].to_s) ? params[:scope].to_s : "all"
  end

  def decide(decision)
    case Appointments::Decide.call(appointment: @appointment, decision: decision, message: params[:message])
    when :approve, :decline then render(json: { appointments: group_rows }, status: :ok)
    when :already_decided then render(json: { error: "already_decided" }, status: :conflict)
    when :expired then render(json: { error: "expired" }, status: :conflict)
    else render(json: { error: "invalid_decision" }, status: :unprocessable_content)
    end
  end

  def group_rows
    Appointment.where(group_key: @appointment.group_key).where.not(status: "rescheduled").includes(:slot).order(:id).map { |row| Appointments::Search.row(row) }
  end

  def load_appointment
    @appointment = Appointment.where(form_id: current_user.forms.select(:id)).find(params[:id])
  end
end
