class ExpireInactiveShortlinksJob < ApplicationJob
  queue_as :default

  INACTIVITY_PERIOD = 30.days

  def perform
    cutoff = INACTIVITY_PERIOD.ago
    inactivity_condition = "COALESCE(last_accessed_at, created_at) < ?"

    deactivated = Shortlink.where(inactive_at: nil)
      .where(inactivity_condition, cutoff)
      .update_all(inactive_at: Time.current)

    Rails.logger.info("[ExpireInactiveShortlinksJob]: deactivated=#{deactivated} cutoff=#{cutoff.iso8601}")
  end
end
