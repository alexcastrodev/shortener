class PurgeMcpToolCallsJob < ApplicationJob
  queue_as :default

  RETENTION = 90.days

  def perform
    McpToolCall.where(created_at: ...RETENTION.ago).in_batches(of: 1000, &:delete_all)
  end
end
