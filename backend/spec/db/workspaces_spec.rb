require "rails_helper"

RSpec.describe("workspaces in the database") do
  let(:connection) { ActiveRecord::Base.connection }
  let(:user) { FactoryBot.create(:user) }
  let(:other) { FactoryBot.create(:user) }
  let(:workspace) { Workspace.create!(user: user, name: "Mine") }

  def insert_form(workspace_id:, user_id:)
    connection.execute(<<~SQL.squish)
      INSERT INTO forms (user_id, workspace_id, public_id, title, created_at, updated_at)
      VALUES (#{user_id}, #{workspace_id || "NULL"}, '#{SecureRandom.alphanumeric(12)}', 'Raw', NOW(), NOW())
    SQL
  end

  def violates(&block)
    expect { ActiveRecord::Base.transaction(requires_new: true, &block) }.to(raise_error(ActiveRecord::InvalidForeignKey))
  end

  it "accepts a form in a workspace of its owner" do
    expect { insert_form(workspace_id: workspace.id, user_id: user.id) }.not_to(raise_error)
  end

  it "rejects a form whose workspace belongs to somebody else" do
    violates { insert_form(workspace_id: workspace.id, user_id: other.id) }
  end

  it "still accepts a form with no workspace while the column is being filled" do
    expect { insert_form(workspace_id: nil, user_id: user.id) }.not_to(raise_error)
  end
end
