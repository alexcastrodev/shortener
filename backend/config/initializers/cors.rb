# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

# Credentialed requests (the httpOnly session cookie) are allowed, so the
# list is exact: no wildcard subdomains (other kurz.fyi hosts, such as the
# blob storage, must not be able to act with a user's session) and no
# localhost in production.
allowed_origins = ["https://kurz.fyi", "https://app.kurz.fyi", ENV["FRONTEND_URL"]]
allowed_origins << "http://localhost:5173" unless Rails.env.production?

Rails.application.config.middleware.insert_before(0, Rack::Cors) do
  allow do
    origins(*allowed_origins.compact_blank.uniq)

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      # Lets the frontend send the httpOnly session cookie.
      credentials: true
  end
end
