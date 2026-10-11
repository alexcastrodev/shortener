module Appointments
  module Durations
    extend self

    def options(service)
      [service.slice("duration", "price"), *Array(service["extra_durations"]).map { |item| item.slice("duration", "price") }]
    end

    def minutes(service) = options(service).pluck("duration")

    def option(service, minutes) = options(service).find { |item| item["duration"] == minutes }

    def monthly_minutes(service) = service.dig("monthly", "duration") || service["duration"]
  end
end
