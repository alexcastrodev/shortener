module Appointments
  module Resource
    extend self

    def key(service) = service["resource_key"] || service["id"]
  end
end
