class SendAppointmentRemindersJob < ApplicationJob
  queue_as :notifications

  def perform
    Appointments::SendReminders.call
  end
end
