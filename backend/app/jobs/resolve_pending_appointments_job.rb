class ResolvePendingAppointmentsJob < ApplicationJob
  queue_as :notifications

  def perform
    lag = Appointments::ResolveExpired.lag
    resolved = Appointments::ResolveExpired.call
    Appointments::Waitlist.sweep
    Rails.logger.info("[appointments] resolved=#{resolved} oldest_overdue_seconds=#{lag}")
  end
end
