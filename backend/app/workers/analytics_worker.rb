require "sneakers"

class AnalyticsWorker
  include Sneakers::Worker
  from_queue "analytics", durable: true

  def work(msg)
    data = JSON.parse(msg)
    Rails.logger.info "Logged analytics data: #{data}"

    ack!
  rescue => e
    logger.error "Erro: #{e.message}"
    requeue!
  end
end
