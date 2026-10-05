module Mcp
  module Tools
    class UpdatePage < Mcp::BaseTool
      tool_name "update_page"
      title "Edit a bio page draft"
      description "Edits the title, bio, theme (or custom_colors) or address of an unpublished page. Published pages must be edited in the dashboard."
      input_schema(
        properties: {
          id: { type: "integer", minimum: 1 },
          display_title: { type: "string", maxLength: 80 },
          bio: { type: "string", maxLength: 300 },
          theme: { type: "string", enum: Page::THEMES },
          custom_colors: CustomColors::JSON_SCHEMA,
          slug: { type: "string", maxLength: 30 },
        },
        required: ["id"],
        additionalProperties: false,
      )
      annotations(read_only_hint: false, destructive_hint: false, idempotent_hint: true, open_world_hint: false)
      requires "pages:write", writes: true

      def self.perform(user:, id:, **changes)
        page = Mcp::Guards.draft_page(user, id)
        attributes = Mcp::Guards.contract!(PageUpdateContract, changes)
        page.assign_attributes(attributes)
        Mcp::Guards.saved!(page)
        PageToolHelpers.page_json(page.reload, links: true)
      end
    end
  end
end
