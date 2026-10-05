class CreateFormUploads < ActiveRecord::Migration[8.1]
  def change
    create_table(:form_uploads) do |t|
      t.references(:form, null: false, foreign_key: true, index: true)
      t.references(:response, foreign_key: { to_table: :form_responses, on_delete: :nullify }, index: true)
      t.string(:field_id, null: false, limit: 8)
      t.string(:token, null: false, limit: 24)
      t.datetime(:created_at, null: false)
    end
    add_index(:form_uploads, :token, unique: true)
    add_index(:form_uploads, :created_at, where: "response_id IS NULL", name: "index_form_uploads_orphans")
  end
end
