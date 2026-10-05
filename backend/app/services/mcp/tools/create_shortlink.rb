module Mcp
  module Tools
    class CreateShortlink < Mcp::BaseTool
      TITLE_MAX = 120

      tool_name "create_shortlink"
      title "Create a short link"
      description "Creates a short link to an http or https URL. It cannot change or delete existing links."
      input_schema(
        properties: {
          original_url: { type: "string", maxLength: 2048 },
          title: { type: "string", maxLength: TITLE_MAX },
          expires_at: { type: "string", maxLength: 40 },
        },
        required: ["original_url"],
        additionalProperties: false,
      )
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: false, open_world_hint: false)
      requires "shortlinks:write", writes: true, limits: [[20, 1.hour], [100, 1.day]]

      def self.perform(user:, original_url:, title: nil, expires_at: nil)
        raise Mcp::ToolError.new("invalid_input", "title is too long") if title.to_s.length > TITLE_MAX

        validated = ShortlinkContract.new.call(original_url: original_url, title: title, expires_at: expires_at)
        raise Mcp::ToolError.new("invalid_input", validated.errors.to_h.keys.join(", ")) if validated.errors.any?

        link = user.shortlinks.new(validated.to_h)
        raise Mcp::ToolError.new("invalid_input", link.errors.full_messages.to_sentence) unless link.save

        Mcp::Tools.shortlink(link)
      end
    end
  end
end
