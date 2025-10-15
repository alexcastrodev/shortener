require "rails_helper"
require "rake"

RSpec.describe("shortlink:clear_policy", type: :task) do
  before do
    Rake::Task["shortlink:clear_policy"].reenable
  end

  before(:all) do
    Rails.application.load_tasks
  end

  describe "clearing old shortlinks" do
    # No User
    let!(:recent_shortlink) { FactoryBot.create(:shortlink, last_accessed_at: 15.days.ago) }
    let!(:old_shortlink) { FactoryBot.create(:shortlink, last_accessed_at: 31.days.ago) }
    let!(:very_old_shortlink) { FactoryBot.create(:shortlink, last_accessed_at: 60.days.ago) }
    let!(:never_accessed_shortlink) { FactoryBot.create(:shortlink, last_accessed_at: nil, created_at: 31.days.ago) }

    # User
    let!(:recent_shortlink_user) { FactoryBot.create(:shortlink, :with_user, last_accessed_at: 15.days.ago) }
    let!(:old_shortlink_user) { FactoryBot.create(:shortlink, :with_user, last_accessed_at: 31.days.ago) }
    let!(:very_old_shortlink_user) { FactoryBot.create(:shortlink, :with_user, last_accessed_at: 60.days.ago) }
    let!(:never_accessed_shortlink_user) { FactoryBot.create(:shortlink, :with_user, last_accessed_at: nil) }

    it "deletes shortlinks not accessed in the last 30 days" do
      Rake::Task["shortlink:clear_policy"].invoke

      [recent_shortlink_user, old_shortlink_user, very_old_shortlink_user, never_accessed_shortlink_user].each do |shortlink|
        expect(Shortlink.exists?(shortlink.id)).to(eq(true))
      end

      expect(Shortlink.exists?(recent_shortlink.id)).to(eq(true))
      expect(Shortlink.exists?(old_shortlink.id)).to(eq(false))
      expect(Shortlink.exists?(very_old_shortlink.id)).to(eq(false))
      expect(Shortlink.exists?(never_accessed_shortlink.id)).to(eq(false))
    end
  end
end
