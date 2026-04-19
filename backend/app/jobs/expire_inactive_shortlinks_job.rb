class ExpireInactiveShortlinksJob < ApplicationJob
  queue_as :default

  INACTIVITY_PERIOD = 30.days

  def perform
    cutoff = INACTIVITY_PERIOD.ago
    inactivity_condition = "COALESCE(last_accessed_at, created_at) < ?"

    deleted = Shortlink.without_user.where(inactivity_condition, cutoff).in_batches(of: 500).destroy_all.count

    deactivated = Shortlink.where.not(user_id: nil)
      .where(inactive_at: nil)
      .where(inactivity_condition, cutoff)
      .update_all(inactive_at: Time.current)

    Rails.logger.info("[ExpireInactiveShortlinksJob]: deleted=#{deleted} deactivated=#{deactivated} cutoff=#{cutoff.iso8601}")
  end
end
