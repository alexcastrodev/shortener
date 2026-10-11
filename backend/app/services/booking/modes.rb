module Booking
  module Modes
    extend self

    NAMES = ["services", "individual"].freeze

    def fetch(name)
      case name
      when nil, "services" then Services
      when "individual" then Individual
      end
    end

    def compile(field)
      return field unless field["type"] == "booking"

      fetch(field["mode"])&.compile(field) || field
    end
  end
end
