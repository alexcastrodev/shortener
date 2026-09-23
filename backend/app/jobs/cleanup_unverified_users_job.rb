# Accounts are created when a sign-in code is requested; the ones whose code
# was never confirmed are removed after a day, so typing random addresses into
# the form does not leave rows behind.
class CleanupUnverifiedUsersJob < ApplicationJob
  queue_as :default

  GRACE = 1.day

  def perform
    User.where(verified_at: nil, created_at: ...GRACE.ago).in_batches(of: 500) do |batch|
      batch.destroy_all
    end
  end
end
