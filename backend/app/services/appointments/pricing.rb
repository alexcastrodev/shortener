module Appointments
  module Pricing
    extend self

    def call(service:, durations:)
      return unless service["price"] && service["currency"]

      total = durations.sum(BigDecimal("0")) { |minutes| BigDecimal(Durations.option(service, minutes)["price"].to_s) }
      { total: total.round(2).to_f, currency: service["currency"] }
    end
  end
end
