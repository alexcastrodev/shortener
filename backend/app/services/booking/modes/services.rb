module Booking
  module Modes
    module Services
      extend self

      def errors(field) = Forms::BookingSchema.services_errors(field)

      def publish_blocks(fields) = Forms::BookingSchema.services_publish_blocks(fields)

      def compile(field) = field
    end
  end
end
