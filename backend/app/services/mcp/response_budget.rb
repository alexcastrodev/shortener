module Mcp
  module ResponseBudget
    extend self

    DAILY = 2_000

    def used(user)
      McpToolCall.joins(:oauth_grant).where(oauth_grants: { user_id: user.id }).where(created_at: 24.hours.ago..).sum(:records_returned)
    end

    def remaining(user)
      [DAILY - used(user), 0].max
    end
  end
end
