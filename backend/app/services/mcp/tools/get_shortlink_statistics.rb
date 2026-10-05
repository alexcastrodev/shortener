module Mcp
  module Tools
    class GetShortlinkStatistics < Mcp::BaseTool
      tool_name "get_shortlink_statistics"
      title "Short link statistics"
      description "Aggregate visit counts of one short link by country, region, browser and device."
      input_schema(properties: { id: { type: "integer", minimum: 1 } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "shortlinks:read"

      def self.perform(user:, id:)
        link = user.shortlinks.find(id)
        { id: link.id, statistics: link.event_statistics }
      end
    end
  end
end
