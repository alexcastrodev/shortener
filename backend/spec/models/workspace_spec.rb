require "rails_helper"

RSpec.describe(Workspace, type: :model) do
  let(:user) { FactoryBot.create(:user) }

  def build_workspace(**attrs)
    described_class.new({ user: user, name: "Studio" }.merge(attrs))
  end

  it "starts in the services mode" do
    expect(build_workspace.tap(&:save!).mode).to(eq("services"))
  end

  it "needs a name of at most 80 characters and a known mode" do
    expect(build_workspace(name: "")).not_to(be_valid)
    expect(build_workspace(name: "a" * 81)).not_to(be_valid)
    expect(build_workspace(mode: "salon")).not_to(be_valid)
  end

  it "keeps its mode for life" do
    workspace = build_workspace.tap(&:save!)
    expect { workspace.update(mode: "individual") }.to(raise_error(ActiveRecord::ReadonlyAttributeError))
    expect(workspace.reload.mode).to(eq("services"))
  end

  it "limits an account to ten" do
    described_class::MAX_PER_USER.times { |index| build_workspace(name: "W#{index}").save! }
    expect(build_workspace(name: "one more")).not_to(be_valid)
    expect(described_class.where(user: user).count).to(eq(10))
    expect(build_workspace(user: FactoryBot.create(:user))).to(be_valid)
  end

  describe ".default_for" do
    it "creates the first workspace once and keeps returning it" do
      first = described_class.default_for(user)
      expect(first).to(have_attributes(name: "Main", mode: "services"))
      expect(described_class.default_for(user)).to(eq(first))
      expect(described_class.where(user: user).count).to(eq(1))
    end

    it "returns the oldest workspace of the account" do
      oldest = build_workspace(name: "Old").tap(&:save!)
      build_workspace(name: "New").save!
      expect(described_class.default_for(user)).to(eq(oldest))
    end
  end

  it "cannot be destroyed while it still has forms" do
    workspace = build_workspace.tap(&:save!)
    Form.create!(user: user, title: "Contact", workspace: workspace)
    expect { workspace.destroy }.to(raise_error(ActiveRecord::DeleteRestrictionError))
  end

  it "goes away with the account, after its forms" do
    form = Form.create!(user: user, title: "Contact")
    workspace = form.workspace
    user.destroy!
    expect(described_class.exists?(workspace.id)).to(be(false))
    expect(Form.exists?(form.id)).to(be(false))
  end
end
