module Appointments
  module Pricing
    extend self

    def call(service:, count:)
      return unless service["price"] && service["currency"]

      bundle = service["bundle"]
      paid = bundle ? count / bundle["take"] * bundle["pay"] + count % bundle["take"] : count
      total = (BigDecimal(service["price"].to_s) * paid).round(2)
      { total: total.to_f, currency: service["currency"], paid_sessions: paid, free_sessions: count - paid }
    end
  end
end
