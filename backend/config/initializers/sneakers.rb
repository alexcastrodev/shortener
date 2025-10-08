require 'uri'

Sneakers.configure(
  amqp: "amqp://#{ENV['RABBITMQ_DEFAULT_USER']}:#{URI.encode_www_form_component(ENV['RABBITMQ_DEFAULT_PASS'])}@#{ENV['RABBITMQ_HOST']}:#{ENV['RABBITMQ_PORT'] || 5672}/",
  vhost: "/",
  threads: 1,
  workers: 5,
  durable: true,
  prefetch: 10,
  timeout_job_after: 60,
  log: STDOUT,
  ack: true
)
