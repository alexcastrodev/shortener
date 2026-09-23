class AddCommunityTemplatesAndAbuseSignals < ActiveRecord::Migration[8.0]
  def change
    change_table(:page_templates, bulk: true) do |t|
      # private: only the owner; public: listed in Community (as placeholders).
      t.string(:visibility, null: false, default: "private")
      t.string(:description)
      # Shown as the author ("by Title · @slug"); the label is a snapshot so
      # the author stays visible if that page is later unpublished.
      t.references(:author_page, foreign_key: { to_table: :pages, on_delete: :nullify })
      t.string(:author_label)
      t.datetime(:published_at)
      t.integer(:uses_count, null: false, default: 0)
      t.integer(:reports_count, null: false, default: 0)
      t.datetime(:hidden_at)
    end
    add_index(:page_templates, [:visibility, :hidden_at, :uses_count])

    create_table(:page_template_reports) do |t|
      t.references(:page_template, null: false, foreign_key: { on_delete: :cascade })
      t.references(:user, null: false, foreign_key: { on_delete: :cascade })
      t.string(:reason, null: false)
      t.timestamps
    end
    add_index(:page_template_reports, [:page_template_id, :user_id], unique: true)

    # Flags for admins: several new accounts publishing the same page.
    create_table(:abuse_signals) do |t|
      t.string(:kind, null: false)
      t.string(:fingerprint, null: false)
      t.jsonb(:user_ids, null: false, default: [])
      t.jsonb(:page_ids, null: false, default: [])
      t.string(:status, null: false, default: "open")
      t.datetime(:first_seen_at, null: false)
      t.datetime(:last_seen_at, null: false)
      t.timestamps
    end
    add_index(:abuse_signals, [:kind, :fingerprint], unique: true)
    add_index(:abuse_signals, :status)
  end
end
