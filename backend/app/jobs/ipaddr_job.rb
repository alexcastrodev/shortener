class IpaddrJob < ApplicationJob
  include RetryableJob
  queue_as :analytics

  # Any click record with ip_address/country_code/region columns can be
  # enriched (Event for shortlinks, PageLinkClick for bio pages).
  MODELS = ["Event", "PageLinkClick"].freeze

  def perform(record_id, retry_count: 3, model: "Event")
    return unless MODELS.include?(model)

    event = model.constantize.find_by(id: record_id)
    return if event.nil?
    # The address goes into the request path below; never send anything
    # that is not a plain IP.
    return unless valid_ip?(event.ip_address)

    # https://ip-api.com/docs
    response = HTTParty.get("http://ip-api.com/json/#{event.ip_address}")
    Rails.logger.info("IP API response: #{response.parsed_response}")
    # Keep values already provided by the edge (Cloudflare headers).
    if response.code == 200 && response.parsed_response["status"] == "success"
      event.country_code ||= response.parsed_response["countryCode"]
      event.region ||= response.parsed_response["regionName"]
    end

    event.save! if event.changed?
  end

  private

  def valid_ip?(value)
    IPAddr.new(value.to_s)
    true
  rescue IPAddr::InvalidAddressError, IPAddr::AddressFamilyError
    false
  end
end
