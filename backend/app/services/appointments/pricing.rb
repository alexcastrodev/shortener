module Appointments
  module Pricing
    extend self

    def call(service:, count:)
      return unless service["price"] && service["currency"]

      total = (BigDecimal(service["price"].to_s) * count).round(2)
      { total: total.to_f, currency: service["currency"] }
    end
  end
end
