namespace :shortlink do
  desc "Deactivate shortlinks not accessed in the last 30 days"
  task clear_policy: :environment do
    ExpireInactiveShortlinksJob.perform_now
  end

  # Also migrates entries written in the old raw-URL format to JSON. Keys are
  # overwritten in place (never flushed first), so redirects keep working
  # while it runs and unrelated keys in the same Redis (rate limit counters)
  # are left alone.
  desc "Rewrite the redis cache for all shortlinks"
  task update_cache: :environment do
    Shortlink.with_deleted.find_each do |shortlink|
      if shortlink.deleted_at.nil? && shortlink.servable?
        shortlink.save_cache
      else
        shortlink.remove_cache
      end
    end
  end
end
