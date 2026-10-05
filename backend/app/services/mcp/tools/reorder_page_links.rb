module Mcp
  module Tools
    class ReorderPageLinks < Mcp::BaseTool
      tool_name "reorder_page_links"
      title "Reorder the links of a bio page draft"
      description "Sets the order of every link of an unpublished page. The list must contain each link id exactly once."
      input_schema(properties: { page_id: { type: "integer", minimum: 1 }, ids: { type: "array", items: { type: "integer", minimum: 1 }, maxItems: PageLink::MAX_PER_PAGE } }, required: ["page_id", "ids"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "pages:write", writes: true

      def self.perform(user:, page_id:, ids:)
        page = Mcp::Guards.draft_page(user, page_id)
        raise Mcp::ToolError.new("invalid_input", "ids must list every link exactly once") unless ids.uniq.size == ids.size && ids.sort == page.page_links.map(&:id).sort

        PageLink.transaction do
          ids.each_with_index { |id, index| page.page_links.where(id: id).update_all(position: index + 1, updated_at: Time.current) }
        end
        PageToolHelpers.page_json(page.reload, links: true)
      end
    end
  end
end
