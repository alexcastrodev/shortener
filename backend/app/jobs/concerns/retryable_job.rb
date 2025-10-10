module RetryableJob
  extend ActiveSupport::Concern

  included do
    rescue_from(StandardError) do |exception|
      handle_retry(exception)
    end
  end

  private

  def handle_retry(exception)
    retry_count = (arguments.last[:retry_count] || 0) + 1
    max_retries = 5
    wait_seconds = 2**retry_count

    if retry_count <= max_retries
      Rails.logger.warn("Retrying #{self.class.name} (#{retry_count}/#{max_retries}) after #{wait_seconds}s due to #{exception.class}: #{exception.message}")
      self.class.set(wait: wait_seconds.seconds).perform_later(*arguments.first(1), retry_count: retry_count)
    else
      Rails.logger.error("#{self.class.name} failed permanently after #{max_retries} attempts")
    end
  end
end
