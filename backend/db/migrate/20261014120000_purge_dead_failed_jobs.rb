class PurgeDeadFailedJobs < ActiveRecord::Migration[8.1]
  def up
    execute(<<~SQL)
      DELETE FROM solid_queue_jobs
      WHERE class_name IN ('IpaddrJob', 'ExpireInactiveShortlinksJob', 'ActionMailer::MailDeliveryJob')
        AND id IN (
          SELECT job_id FROM solid_queue_failed_executions
          WHERE created_at < TIMESTAMP '2026-05-11 00:00:00'
        )
    SQL
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
