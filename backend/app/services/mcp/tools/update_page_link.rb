module Mcp
  module Tools
    class UpdatePageLink < Mcp::BaseTool
      tool_name "update_page_link"
      title "Edit a link of a bio page draft"
      description "Changes the label, URL, icon or kind of a link on an unpublished page."
      input_schema(properties: { page_id: { type: "integer", minimum: 1 }, id: { type: "integer", minimum: 1 } }.merge(PageToolHelpers::LINK_FIELDS.except(:kind)), required: ["page_id", "id"], additionalProperties: false)
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "pages:write", writes: true

      def self.perform(user:, page_id:, id:, **fields)
        page = Mcp::Guards.draft_page(user, page_id)
        link = page.page_links.find(id)
        link.assign_attributes(Mcp::Guards.contract!(PageLinkUpdateContract, fields))
        Mcp::Guards.saved!(link)
        PageToolHelpers.link_json(link)
      end
    end
  end
end
