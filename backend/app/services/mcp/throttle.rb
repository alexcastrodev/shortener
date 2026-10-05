module Mcp
  class RateLimited < StandardError; end

  module Throttle
    extend self

    WRITES = [[30, 1.minute], [500, 1.day]].freeze

    def check!(user, bucket, limits)
      limits.each do |limit, window|
        key = "mcp-throttle:#{bucket}:#{user.id}:#{window.to_i}"
        count = Rails.cache.increment(key, 1, expires_in: window)
        raise RateLimited if count && count > limit
      end
    end
  end
end
