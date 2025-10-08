require "sneakers"

class AnalyticsWorker
  include Sneakers::Worker
  from_queue "analytics", durable: true

  def work(msg)
    data = JSON.parse(msg)
    logger.info "Logged analytics data: #{data}"

    File.open("log/analytics.log", "a") do |f|
      f.puts("#{Time.now}: #{data}")
    end

    ack!
  rescue => e
    logger.error "Erro: #{e.message}"
    requeue!
  end
end
