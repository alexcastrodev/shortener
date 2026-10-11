require "rails_helper"
require Rails.root.join("db/migrate/20261012090200_backfill_workspaces_of_forms")

RSpec.describe(BackfillWorkspacesOfForms) do
  let(:connection) { ActiveRecord::Base.connection }
  let(:first_user) { FactoryBot.create(:user) }
  let(:second_user) { FactoryBot.create(:user) }
  let(:idle_user) { FactoryBot.create(:user) }

  def raw_form(user, workspace_id: nil)
    connection.select_value(<<~SQL.squish)
      INSERT INTO forms (user_id, workspace_id, public_id, title, created_at, updated_at)
      VALUES (#{user.id}, #{workspace_id || "NULL"}, '#{SecureRandom.alphanumeric(12)}', 'Raw', NOW(), NOW()) RETURNING id
    SQL
  end

  def workspace_of(form_id) = connection.select_value("SELECT workspace_id FROM forms WHERE id = #{form_id}")

  def migrate = ActiveRecord::Migration.suppress_messages { described_class.new.up }

  it "gives every owner of forms one services workspace and puts all their forms in it" do
    forms = [raw_form(first_user), raw_form(first_user), raw_form(second_user)]
    idle_user

    migrate

    expect(Workspace.where(user: first_user).pluck(:name, :mode)).to(eq([["Main", "services"]]))
    expect(Workspace.where(user: second_user).count).to(eq(1))
    expect(Workspace.where(user: idle_user).count).to(eq(0))
    expect(forms.map { |id| workspace_of(id) }).to(eq([Workspace.find_by(user: first_user).id] * 2 + [Workspace.find_by(user: second_user).id]))
  end

  it "reuses the workspace an owner already has and leaves placed forms alone" do
    kept = Workspace.create!(user: first_user, name: "Kept")
    placed = raw_form(first_user, workspace_id: kept.id)
    loose = raw_form(first_user)

    migrate

    expect(Workspace.where(user: first_user).count).to(eq(1))
    expect([workspace_of(placed), workspace_of(loose)]).to(eq([kept.id, kept.id]))
  end

  it "can run again without changing anything" do
    form = raw_form(first_user)
    migrate
    workspace = workspace_of(form)

    migrate

    expect(workspace_of(form)).to(eq(workspace))
    expect(Workspace.where(user: first_user).count).to(eq(1))
  end
end
