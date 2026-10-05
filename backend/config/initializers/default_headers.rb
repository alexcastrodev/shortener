class DefaultHeaders
  HEADERS = {
    "x-content-type-options" => "nosniff",
    "content-security-policy" => "default-src 'none'; frame-ancestors 'none'",
  }.freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    status, headers, body = @app.call(env)
    HEADERS.each { |name, value| headers[name] = value unless headers.key?(name) }
    [status, headers, body]
  end
end

Rails.application.config.middleware.insert_before(0, DefaultHeaders)
