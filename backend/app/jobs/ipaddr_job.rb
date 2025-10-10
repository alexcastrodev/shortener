class IpaddrJob < ApplicationJob
  include RetryableJob
  queue_as :default

  def perform(event_id, retry_count: 3)
    event = Event.find_by(id: event_id)
    return if event.nil?

    # https://ip-api.com/docs
    response = HTTParty.get("http://ip-api.com/json/#{event.ip_address}")
    Rails.logger.info("IP API response: #{response.parsed_response}")
    if response.code == 200 && response.parsed_response["status"] == "success"
      event.country_code = response.parsed_response["countryCode"]
      event.region = response.parsed_response["regionName"]
    else
      event.country_code = nil
      event.region = nil
    end

    event.save!
  end
end
