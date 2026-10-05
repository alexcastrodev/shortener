class AddRecordsReturnedToMcpToolCalls < ActiveRecord::Migration[8.1]
  def change
    add_column(:mcp_tool_calls, :records_returned, :integer, null: false, default: 0)
  end
end
