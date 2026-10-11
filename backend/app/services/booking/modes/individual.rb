module Booking
  module Modes
    module Individual
      extend self

      RESOURCE = "main".freeze
      AVAILABILITY_KEYS = ["days", "times", "times_by_day"].freeze

      def errors(field)
        schema = Forms::BookingSchema
        services = field["services"]
        rules = field["rules"]
        return ["services must be a list"] unless services.is_a?(Array)
        return ["rules must be an object"] unless rules.is_a?(Hash)

        result = []
        result << "can have at most #{schema::SERVICES_MAX} services" if services.size > schema::SERVICES_MAX
        result << "categories are not available in this mode" if field["categories"].present?
        result.concat(availability_errors(field["availability"]))
        ids = []
        services.each_with_index do |raw, index|
          label = "service #{index + 1}"
          unless raw.is_a?(Hash)
            result << "#{label} must be an object"
            next
          end

          service = raw.stringify_keys
          result << "#{label} id is invalid or repeated" unless service["id"].to_s.match?(Forms::FieldSchema::ID_FORMAT) && !ids.include?(service["id"])
          ids << service["id"]
          result.concat(schema.service_errors(service.except(*AVAILABILITY_KEYS), schedule: false).map { |message| "#{label} #{message}" })
          result.concat(schema.schedule_errors(service).map { |message| "#{label} #{message}" }) if own?(service)
        end
        result.concat(schema.rule_errors(rules.stringify_keys))
        result << "the waiting list is not available in this mode" if rules["waitlist"] == true
        result.concat(schema.exception_errors(field["exceptions"], ids))
      end

      def publish_blocks(fields)
        schema = Forms::BookingSchema
        booking = fields.find { |field| field["type"] == "booking" }
        availability = booking["availability"] || {}
        blocks = []
        blocks << schema.block("no_service", "add at least one service") if booking["services"].to_a.empty?
        blocks << schema.block("availability_incomplete", "add at least one day and one time you are available") if availability["days"].blank? || availability["times"].blank?
        booking["services"].to_a.select { |service| own?(service) && (service["days"].blank? || service["times"].blank?) }.each do |service|
          blocks << schema.block("service_incomplete", "#{service["name"]} needs at least one day and one time", name: service["name"], service_id: service["id"])
        end
        blocks.concat(schema.common_blocks(fields, booking))
      end

      def compile(field)
        availability = (field["availability"] || {}).slice(*AVAILABILITY_KEYS)
        field.merge("services" => field["services"].to_a.map { |service| (own?(service) ? service : service.merge(availability)).merge("resource_key" => RESOURCE) })
      end

      private

      def own?(service) = service.keys.intersect?(AVAILABILITY_KEYS)

      def availability_errors(availability)
        return [] if availability.nil?
        return ["availability must be an object"] unless availability.is_a?(Hash) && (availability.keys - AVAILABILITY_KEYS).empty?

        Forms::BookingSchema.schedule_errors(availability).map { |message| "availability #{message}" }
      end
    end
  end
end
