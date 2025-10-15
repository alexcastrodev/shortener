namespace :shortlink do
  desc "Clear shortlinks not accessed in the last 30 days"
  task clear_policy: :environment do
    Shortlink.without_user.where("last_accessed_at < ?", 30.days.ago)
      .or(Shortlink.without_user.where(last_accessed_at: nil).where("created_at < ?", 30.days.ago))
      .delete_all
  end
end
