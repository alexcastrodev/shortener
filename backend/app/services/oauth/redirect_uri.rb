module Oauth
  module RedirectUri
    extend self

    LOOPBACK_HOSTS = ["127.0.0.1", "[::1]", "localhost"].freeze
    MAX_LENGTH = 2048

    def allowed_hosts
      ENV.fetch("MCP_REDIRECT_HOSTS", "claude.ai,claude.com,chatgpt.com").split(",").map(&:strip).reject(&:empty?)
    end

    def valid?(value)
      parse(value).present?
    end

    def match?(registered, requested)
      registered = parse(registered)
      requested = parse(requested)
      return false unless registered && requested
      return registered.to_s == requested.to_s unless loopback?(registered) && loopback?(requested)

      registered.scheme == requested.scheme && registered.host == requested.host && registered.path == requested.path && registered.query == requested.query
    end

    private

    def parse(value)
      return unless value.is_a?(String) && value.length <= MAX_LENGTH && value == value.strip && value.ascii_only?
      return if value.match?(/[\u0000-\u001f\\]/)

      uri = URI.parse(value)
      return unless uri.is_a?(URI::HTTP) && uri.host.present? && uri.fragment.nil? && uri.userinfo.nil?
      return uri if loopback?(uri) && uri.scheme == "http"
      return unless uri.scheme == "https" && allowed_hosts.include?(uri.host) && uri.host == uri.host.downcase

      uri
    rescue URI::InvalidURIError
      nil
    end

    def loopback?(uri)
      LOOPBACK_HOSTS.include?(uri.host)
    end
  end
end
