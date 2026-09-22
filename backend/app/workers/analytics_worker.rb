require "sneakers"

class AnalyticsWorker
  include Sneakers::Worker
  from_queue "analytics", durable: true

  def work_with_params(msg, delivery_info, _metadata)
    data = JSON.parse(msg).with_indifferent_access
    shortlink = Shortlink.find_by(short_code: data[:shortlink_code])
    return reject! unless shortlink

    Event.create!(
      shortlink: shortlink,
      clicked_at: data[:timestamp],
      # optional
      ip_address: data[:ip_address],
      country_code: data[:country_code],
      region: data[:region],
      platform: data[:platform],
      browser: data[:browser],
      referer: data[:referer],
      user_agent: data[:user_agent],
    )

    ack!
  rescue => e
    logger.error("[AnalyticsWorker] #{e.class}: #{e.message}")
    Sentry.capture_exception(e)

    # Every message must be acked or rejected, otherwise it stays unacked and
    # blocks the prefetch window. Retry once for transient failures (e.g. DB
    # hiccup), then drop it so a poison message can't loop forever.
    delivery_info&.redelivered? ? reject! : requeue!
  end
end
