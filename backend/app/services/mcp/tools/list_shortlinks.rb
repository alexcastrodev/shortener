module Mcp
  module Tools
    class ListShortlinks < Mcp::BaseTool
      tool_name "list_shortlinks"
      title "List short links"
      description "Lists the user's short links, newest first."
      input_schema(properties: { page: { type: "integer", minimum: 1, maximum: 10_000 }, per_page: { type: "integer", minimum: 1, maximum: 50 } }, additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "shortlinks:read"

      def self.perform(user:, page: 1, per_page: 20)
        scope = user.shortlinks.order(created_at: :desc, id: :desc)
        rows = scope.offset((page - 1) * per_page).limit(per_page)
        { shortlinks: rows.map { |link| Mcp::Tools.shortlink(link) }, page: page, per_page: per_page, total: scope.count }
      end
    end
  end
end
