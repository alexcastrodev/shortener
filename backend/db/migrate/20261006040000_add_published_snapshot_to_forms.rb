class AddPublishedSnapshotToForms < ActiveRecord::Migration[8.1]
  def change
    add_column(:forms, :published_snapshot, :jsonb)
    add_column(:forms, :published_version, :integer, default: 0, null: false)
    add_column(:forms, :published_digest, :string)
    add_column(:form_responses, :published_version, :integer)
  end
end
