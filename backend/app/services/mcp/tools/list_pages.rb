module Mcp
  module Tools
    class ListPages < Mcp::BaseTool
      tool_name "list_pages"
      title "List bio pages"
      description "Lists the user's bio pages."
      input_schema(properties: {}, additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "pages:read"

      def self.perform(user:)
        { pages: user.pages.order(created_at: :desc).map { |page| PageToolHelpers.page_json(page) } }
      end
    end
  end
end
