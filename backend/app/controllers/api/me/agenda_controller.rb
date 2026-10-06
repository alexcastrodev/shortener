class Api::Me::AgendaController < ApplicationController
  before_action :authenticate_user!
  include AppointmentsGate

  def show
    from = Date.iso8601(params[:from].to_s)
    to = Date.iso8601(params[:to].to_s)
    return render(json: { error: "invalid_range" }, status: :unprocessable_entity) if to < from || (to - from) >= Appointments::Agenda::MAX_RANGE_DAYS

    sessions = Appointments::Agenda.call(user: current_user, from: from, to: to)
    render(json: { time_zone: current_user.time_zone, sessions: sessions.map { |session| serialize(session) } }, status: :ok)
  rescue Date::Error
    render(json: { error: "invalid_range" }, status: :unprocessable_entity)
  end

  private

  def serialize(session)
    session.merge(
      starts_at: session[:starts_at].iso8601,
      date: session[:date].iso8601,
      appointments: session[:appointments].map do |appointment|
        { id: appointment.id, series: appointment.snapshot["monthly"].present?, status: appointment.status, client_name: appointment.client_name, client_email: appointment.client_email, group_key: appointment.group_key }
      end,
    )
  end
end
