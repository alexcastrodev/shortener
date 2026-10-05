module Mcp
  module Tools
    class AddPageLink < Mcp::BaseTool
      tool_name "add_page_link"
      title "Add a link to a bio page draft"
      description "Adds a link, social icon or section header to an unpublished page. URLs must be http or https."
      input_schema(properties: { page_id: { type: "integer", minimum: 1 } }.merge(PageToolHelpers::LINK_FIELDS), required: ["page_id", "label"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: false, open_world_hint: false)
      requires "pages:write", writes: true

      def self.perform(user:, page_id:, **fields)
        page = Mcp::Guards.draft_page(user, page_id)
        attributes = Mcp::Guards.contract!(PageLinkContract, fields)
        link = page.page_links.new(attributes)
        Mcp::Guards.saved!(link)
        PageToolHelpers.link_json(link)
      end
    end
  end
end
