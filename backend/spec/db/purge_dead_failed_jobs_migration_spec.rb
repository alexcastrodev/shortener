require "rails_helper"
require Rails.root.join("db/migrate/20261014120000_purge_dead_failed_jobs")

RSpec.describe(PurgeDeadFailedJobs) do
  def migrate = ActiveRecord::Migration.suppress_messages { described_class.new.up }

  def conn = ActiveRecord::Base.connection

  def job(class_name, finished_at: nil)
    conn.select_value(<<~SQL)
      INSERT INTO solid_queue_jobs (class_name, queue_name, finished_at, created_at, updated_at)
      VALUES (#{conn.quote(class_name)}, 'default', #{conn.quote(finished_at)}, now(), now())
      RETURNING id
    SQL
  end

  def failed(job_id, at)
    conn.execute("INSERT INTO solid_queue_failed_executions (job_id, error, created_at) VALUES (#{job_id}, 'boom', #{conn.quote(at)})")
  end

  def ready(job_id)
    conn.execute("INSERT INTO solid_queue_ready_executions (job_id, queue_name, created_at) VALUES (#{job_id}, 'default', now())")
  end

  it "removes only the old failures of the three dead classes, with their executions, and can run twice" do
    doomed = [
      ["IpaddrJob", Time.utc(2026, 2, 9)],
      ["IpaddrJob", Time.utc(2026, 4, 11, 23, 59, 59)],
      ["ExpireInactiveShortlinksJob", Time.utc(2026, 5, 10, 3)],
      ["ExpireInactiveShortlinksJob", Time.utc(2026, 5, 10, 23, 59, 59)],
      ["ActionMailer::MailDeliveryJob", Time.utc(2026, 4, 18)],
    ].map { |klass, at| job(klass).tap { |id| failed(id, at) } }

    other_class = job("SomeOtherJob").tap { |id| failed(id, Time.utc(2026, 3, 1)) }
    on_cutoff = job("ExpireInactiveShortlinksJob").tap { |id| failed(id, Time.utc(2026, 5, 11)) }
    after_cutoff = job("IpaddrJob").tap { |id| failed(id, Time.utc(2026, 10, 1)) }
    finished = job("IpaddrJob", finished_at: Time.utc(2026, 3, 1))
    ready_job = job("ExpireInactiveShortlinksJob").tap { |id| ready(id) }
    survivors = [other_class, on_cutoff, after_cutoff, finished, ready_job]

    2.times { migrate }

    expect(conn.select_values("SELECT id FROM solid_queue_jobs ORDER BY id")).to(eq(survivors.sort))
    expect(conn.select_values("SELECT job_id FROM solid_queue_failed_executions ORDER BY job_id")).to(eq([other_class, on_cutoff, after_cutoff].sort))
    expect(conn.select_values("SELECT job_id FROM solid_queue_ready_executions")).to(eq([ready_job]))
    expect(doomed & conn.select_values("SELECT id FROM solid_queue_jobs")).to(be_empty)
  end

  it "is irreversible" do
    expect { described_class.new.down }.to(raise_error(ActiveRecord::IrreversibleMigration))
  end
end
