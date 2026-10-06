class Api::Admin::AppointmentsHealthController < ApplicationController
  before_action :authenticate_user!

  def show
    authorize(:appointment_health, :show?)
    render(json: Appointments::Health.call, status: :ok)
  end
end
