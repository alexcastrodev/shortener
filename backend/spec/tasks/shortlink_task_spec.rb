require "rails_helper"
require "rake"

RSpec.describe("shortlink:clear_policy", type: :task) do
  before do
    Rake::Task["shortlink:clear_policy"].reenable
  end

  before(:all) do
    Rails.application.load_tasks
  end

  describe "deactivating inactive shortlinks" do
    let!(:recent_shortlink) { FactoryBot.create(:shortlink, last_accessed_at: 15.days.ago) }
    let!(:old_shortlink) { FactoryBot.create(:shortlink, last_accessed_at: 31.days.ago) }
    let!(:very_old_shortlink) { FactoryBot.create(:shortlink, last_accessed_at: 60.days.ago) }
    let!(:never_accessed_shortlink) { FactoryBot.create(:shortlink, last_accessed_at: nil, created_at: 31.days.ago) }

    it "deactivates shortlinks not accessed in the last 30 days" do
      Rake::Task["shortlink:clear_policy"].invoke

      expect(recent_shortlink.reload.inactive_at).to(be_nil)
      expect(old_shortlink.reload.inactive_at).to(be_present)
      expect(very_old_shortlink.reload.inactive_at).to(be_present)
      expect(never_accessed_shortlink.reload.inactive_at).to(be_present)
    end
  end
end
