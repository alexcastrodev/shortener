module Mcp
  module Tools
    class UpdateShortlink < Mcp::BaseTool
      tool_name "update_shortlink"
      title "Edit a short link"
      description "Changes the destination URL, title or expiry of an existing short link. Needs full access."
      input_schema(
        properties: {
          id: { type: "integer", minimum: 1 },
          original_url: { type: "string", maxLength: 2048 },
          title: { type: "string", maxLength: 255 },
          expires_at: { type: "string", maxLength: 40 },
        },
        required: ["id"],
        additionalProperties: false,
      )
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: true, open_world_hint: false)
      requires "account:full", writes: true, limits: [[60, 1.hour]]

      def self.perform(user:, id:, **changes)
        link = user.shortlinks.find(id)
        link.update(Mcp::Guards.contract!(ShortlinkUpdateContract, changes))
        raise Mcp::ToolError.new("invalid_input", link.errors.full_messages.to_sentence) if link.errors.any?

        SafetyUrlJob.perform_later(link.id) if link.saved_change_to_original_url? && ENV["ENABLE_GOOGLE_SAFE_LINK"].present?
        refresh_cache(link) if link.saved_change_to_original_url? || link.saved_change_to_expires_at?
        Mcp::Tools.shortlink(link)
      end

      def self.refresh_cache(link)
        return if link.inactive_at.present?

        link.servable? ? link.save_cache : link.remove_cache
      end
    end
  end
end
