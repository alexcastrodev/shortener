module Mcp
  module Tools
    class RemovePageLink < Mcp::BaseTool
      tool_name "remove_page_link"
      title "Remove a link from a bio page draft"
      description "Deletes one link from an unpublished page."
      input_schema(properties: { page_id: { type: "integer", minimum: 1 }, id: { type: "integer", minimum: 1 } }, required: ["page_id", "id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: true, idempotent_hint: true, open_world_hint: false)
      requires "pages:write", writes: true

      def self.perform(user:, page_id:, id:)
        Mcp::Guards.draft_page(user, page_id).page_links.find(id).destroy!
        { removed: id }
      end
    end
  end
end
