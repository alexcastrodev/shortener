require "vcr"
require "webmock/rspec"

UNSAFE_URL = "https://testsafebrowsing.appspot.com/s/malware.html"

VCR.configure do |config|
  config.cassette_library_dir = "spec/vcr_cassettes"
  config.hook_into(:webmock)
  config.configure_rspec_metadata!
  config.filter_sensitive_data("<GOOGLE_SAFE_LINK_KEY>") { ENV["GOOGLE_SAFE_LINK_KEY"] }
  config.default_cassette_options = { record: :once }
  config.allow_http_connections_when_no_cassette = true

  config.before_record do |interaction|
    allowed_headers = [
      "Server",
      "Date",
      "Content-Type",
      "Transfer-Encoding",
      "Connection",
      "X-Powered-By",
      "Expires",
      "Cache-Control",
      "Pragma",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Xss-Protection",
      "Referrer-Policy",
      "Accept",
      "Content-Length",
      "Accept-Encoding",
    ]

    interaction.response.headers.select! { |key, _| allowed_headers.include?(key) }
    interaction.request.headers.select! { |key, _| allowed_headers.include?(key) }

    filtered_response_sensitive_data = []

    response_body = begin
      JSON.parse(interaction.response.body)
    rescue
      {}
    end

    filtered_response_sensitive_data.each do |data|
      if response_body.key?(data)
        response_body[data] = "FILTERED"
      end
    end

    interaction.response.body = response_body.to_json
  end
end

RSpec.configure do |config|
  config.expect_with(:rspec) do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with(:rspec) do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
end
