class McpToolCall < ApplicationRecord
  belongs_to :oauth_grant

  before_create { self.created_at ||= Time.current }
end
