Sneakers.configure(
  amqp: "amqp://#{ENV['RABBITMQ_DEFAULT_USER']}:#{ENV['RABBITMQ_DEFAULT_PASS']}@rabbitmq:#{ENV['RABBITMQ_PORT'] || 5672}/",
  vhost: "/",
  threads: 1,
  workers: 5,
  durable: true,
  prefetch: 10,
  timeout_job_after: 60,
  log: STDOUT,
  ack: true
)
