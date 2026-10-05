module Mcp
  class ToolError < StandardError
    attr_reader :code

    def initialize(code, message = nil)
      @code = code
      super(message || code)
    end
  end

  class BaseTool < MCP::Tool
    class_attribute :required_scope, instance_writer: false
    class_attribute :limits, instance_writer: false, default: []
    class_attribute :writes, instance_writer: false, default: false

    class << self
      def requires(scope, writes: false, limits: [])
        self.required_scope = scope
        self.writes = writes
        self.limits = limits
      end

      def allowed?(scopes)
        base = required_scope.to_s.split(":").first
        Array(scopes).include?(required_scope) || (required_scope.end_with?(":read") && Array(scopes).include?("#{base}:write"))
      end

      def call(server_context:, **args)
        started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        grant = server_context.fetch(:grant)
        return finish(grant, started, error_response("insufficient_scope", "This connection has no access to #{tool_name}")) unless allowed?(server_context[:scopes])

        user = server_context.fetch(:user)
        Throttle.check!(user, "writes", Throttle::WRITES) if writes
        Throttle.check!(user, tool_name, limits) if limits.any?
        result = perform(user: user, **args)
        finish(grant, started, MCP::Tool::Response.new([{ type: "text", text: JSON.generate(result) }], structured_content: result))
      rescue Mcp::RateLimited
        finish(grant, started, error_response("rate_limited", "Too many calls, try again later"))
      rescue Mcp::ToolError => e
        finish(grant, started, error_response(e.code, e.message))
      rescue ActiveRecord::RecordNotFound
        finish(grant, started, error_response("not_found", "Not found"))
      rescue StandardError => e
        Rails.logger.error("[mcp] #{tool_name} failed: #{e.class}")
        finish(grant, started, error_response("tool_failed", "The tool could not complete"))
      end

      private

      def error_response(code, message)
        MCP::Tool::Response.new([{ type: "text", text: JSON.generate(error: code, message: message) }], error: true, structured_content: { error: code, message: message })
      end

      def finish(grant, started, response)
        McpToolCall.create!(
          oauth_grant: grant,
          tool: tool_name,
          status: response.error? ? "error" : "ok",
          error_code: (response.structured_content[:error] if response.error?),
          duration_ms: ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round,
        )
        response
      end
    end
  end
end
