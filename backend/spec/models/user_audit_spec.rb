require "rails_helper"

RSpec.describe("User audit trail", type: :model) do
  it "audits user creation" do
    user = User.create!(email: "test@example.com")

    expect(user.audits.count).to(eq(1))
    expect(user.audits.last.action).to(eq("create"))
  end

  it "audits deactivation" do
    user = FactoryBot.create(:user)
    user.deactivate!

    update_audit = user.audits.find_by(action: "update")
    expect(update_audit).to(be_present)
    expect(update_audit.audited_changes).to(include("deactivated_at"))
  end

  it "does not audit login_token changes" do
    user = FactoryBot.create(:user)
    user.generate_login_token!

    expect(user.audits.where(action: "update").count).to(eq(0))
  end
end
