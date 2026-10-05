module Mcp
  class ToolError < StandardError
    attr_reader :code

    def initialize(code, message = nil)
      @code = code
      super(message || code)
    end
  end

  class BaseTool < MCP::Tool
    STATEMENT_TIMEOUT_MS = 5_000

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
        result = with_statement_timeout { perform(user: user, **args) }
        returned = result.is_a?(Hash) ? result.delete(:returned_records).to_i : 0
        finish(grant, started, MCP::Tool::Response.new([{ type: "text", text: render_text(result) }], structured_content: result), records: returned)
      rescue Mcp::RateLimited
        finish(grant, started, error_response("rate_limited", "Too many calls, try again later"))
      rescue Mcp::ToolError => e
        finish(grant, started, error_response(e.code, e.message))
      rescue ActiveRecord::QueryCanceled
        finish(grant, started, error_response("timeout", "The request took too long"))
      rescue Forms::LimitReached
        finish(grant, started, error_response("forms_daily_limit", "Daily limit of new forms reached"))
      rescue ActiveRecord::RecordInvalid => e
        finish(grant, started, error_response("invalid_input", e.record.errors.full_messages.to_sentence))
      rescue ActiveRecord::RecordNotFound
        finish(grant, started, error_response("not_found", "Not found"))
      rescue StandardError => e
        Rails.logger.error("[mcp] #{tool_name} failed: #{e.class}")
        finish(grant, started, error_response("tool_failed", "The tool could not complete"))
      end

      private

      def with_statement_timeout(&block)
        ActiveRecord::Base.transaction do
          ActiveRecord::Base.connection.execute("SET LOCAL statement_timeout = #{STATEMENT_TIMEOUT_MS}")
          block.call
        end
      end

      def error_response(code, message)
        MCP::Tool::Response.new([{ type: "text", text: JSON.generate(error: code, message: message) }], error: true, structured_content: { error: code, message: message })
      end

      def render_text(result)
        JSON.generate(result)
      end

      def finish(grant, started, response, records: 0)
        McpToolCall.create!(
          oauth_grant: grant,
          tool: tool_name,
          status: response.error? ? "error" : "ok",
          error_code: (response.structured_content[:error] if response.error?),
          records_returned: records,
          duration_ms: ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round,
        )
        response
      end
    end
  end
end
