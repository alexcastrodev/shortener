class CleanupOrphanFormUploadsJob < ApplicationJob
  queue_as :default

  def perform
    FormUpload.orphaned.find_each(&:destroy)
  end
end
