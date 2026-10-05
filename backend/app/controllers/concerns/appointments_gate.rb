module AppointmentsGate
  extend ActiveSupport::Concern

  included do
    before_action :require_appointments!
  end

  private

  def require_appointments!
    head(:not_found) unless Appointments::Config.enabled_for?(current_user)
  end
end
