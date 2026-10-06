class AppointmentsHealthJob < ApplicationJob
  queue_as :default

  def perform
    report = Appointments::Health.call
    Rails.logger.info("[appointments] health #{report.except(:alerts).to_json} alerts=#{report[:alerts].join(",")}")
    report[:alerts].each { |alert| raise_alert(alert, report) }
  end

  private

  def raise_alert(alert, report)
    key = "appointments:health:alerted:#{alert}"
    return unless Rails.cache.write(key, 1, expires_in: 1.hour, unless_exist: true)

    Sentry.capture_message("Appointments: #{alert}", level: :warning, extra: report.except(:alerts))
  end
end
