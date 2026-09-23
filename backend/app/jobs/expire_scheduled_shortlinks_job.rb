# Deactivates links whose owner-set expiration date has passed. Separate from
# ExpireInactiveShortlinksJob (30 days without clicks): different rule and
# cadence, and each reason for deactivation stays auditable on its own.
class ExpireScheduledShortlinksJob < ApplicationJob
  queue_as :default

  def perform
    # One by one (not update_all) so each cache entry is removed right away
    # and the edge stops redirecting.
    Shortlink.expired.find_each(&:expire!)
  end
end
