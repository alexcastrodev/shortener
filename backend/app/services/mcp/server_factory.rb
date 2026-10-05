module Mcp
  module ServerFactory
    extend self

    MAX_REQUEST_BYTES = 256.kilobytes

    def tools
      []
    end

    def call(grant:, request:)
      server = MCP::Server.new(
        name: "kurz",
        version: "1.0.0",
        tools: tools,
        server_context: { user: grant.user, grant: grant, scopes: grant.scopes },
      )
      transport = MCP::Server::Transports::StreamableHTTPTransport.new(
        server,
        stateless: true,
        allowed_hosts: [URI.parse(Oauth::Config.resource).host],
        allowed_origins: ENV.fetch("MCP_ALLOWED_ORIGINS", "").split(",").map(&:strip).reject(&:empty?),
        max_request_bytes: MAX_REQUEST_BYTES,
      )
      transport.handle_request(request)
    end
  end
end
