class PurgeDeletedAccountsJob < ApplicationJob
  queue_as :default

  def perform
    User.where(deletion_requested_at: ...User::DELETION_GRACE.ago).where.not(deactivated_at: nil).find_each(&:purge!)
  end
end
