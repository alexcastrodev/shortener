require "rails_helper"
require Rails.root.join("db/migrate/20261013120000_recount_user_shortlinks")

RSpec.describe(RecountUserShortlinks) do
  def migrate = ActiveRecord::Migration.suppress_messages { described_class.new.up }

  it "sets every user's count to their visible links and can run twice" do
    drifted = FactoryBot.create(:user)
    FactoryBot.create(:shortlink, user: drifted)
    FactoryBot.create(:shortlink, user: drifted).update_columns(deleted_at: Time.current)
    drifted.update_columns(shortlinks_count: 5)
    emptied = FactoryBot.create(:user)
    emptied.update_columns(shortlinks_count: 3)
    correct = FactoryBot.create(:user)
    FactoryBot.create(:shortlink, user: correct)

    2.times { migrate }

    expect(drifted.reload.shortlinks_count).to(eq(1))
    expect(emptied.reload.shortlinks_count).to(eq(0))
    expect(correct.reload.shortlinks_count).to(eq(1))
  end
end
