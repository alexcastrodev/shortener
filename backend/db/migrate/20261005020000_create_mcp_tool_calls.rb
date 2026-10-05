class CreateMcpToolCalls < ActiveRecord::Migration[8.1]
  def change
    create_table(:mcp_tool_calls) do |t|
      t.references(:oauth_grant, null: false, foreign_key: { on_delete: :cascade })
      t.string(:tool, null: false)
      t.string(:status, null: false)
      t.string(:error_code)
      t.integer(:duration_ms, null: false, default: 0)
      t.datetime(:created_at, null: false)
    end
    add_index(:mcp_tool_calls, :created_at)
  end
end
