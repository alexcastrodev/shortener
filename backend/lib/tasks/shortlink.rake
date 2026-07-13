namespace :shortlink do
  desc "Deactivate shortlinks not accessed in the last 30 days"
  task clear_policy: :environment do
    ExpireInactiveShortlinksJob.perform_now
  end

  desc "Update redis cache for all shortlinks"
  task update_cache: :environment do
    Rails.cache.redis.with do |conn|
      conn.flushdb
      Shortlink.find_each do |shortlink|
        shortlink.send(:save_cache)
      end
    end
  end
end
