module Mcp
  module Tools
    class GetPageStatistics < Mcp::BaseTool
      tool_name "get_page_statistics"
      title "Bio page statistics"
      description "Aggregate click counts of a bio page: per link, source, device, browser and country."
      input_schema(properties: { id: { type: "integer", minimum: 1 }, days: { type: "integer", enum: [7, 30, 90] } }, required: ["id"], additionalProperties: false)
      annotations(read_only_hint: true, open_world_hint: false)
      requires "pages:read"

      def self.perform(user:, id:, days: 30)
        Pages::StatisticsService.call(page: Mcp::Guards.page(user, id), days: days)
      end
    end
  end
end
