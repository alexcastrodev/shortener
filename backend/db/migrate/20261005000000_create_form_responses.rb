class CreateFormResponses < ActiveRecord::Migration[8.1]
  def change
    create_table(:form_responses) do |t|
      t.references(:form, null: false, foreign_key: { on_delete: :cascade }, index: false)
      t.jsonb(:answers, null: false, default: {})
      t.string(:country, limit: 2)
      t.string(:platform)
      t.string(:browser)
      t.string(:source)
      t.string(:idempotency_key, limit: 64)
      t.datetime(:created_at, null: false)
    end
    add_index(:form_responses, [:form_id, :id])
    add_index(:form_responses, [:form_id, :created_at])
    add_index(:form_responses, [:form_id, :idempotency_key], unique: true, where: "idempotency_key IS NOT NULL", name: "index_form_responses_on_form_and_idempotency_key")
    add_check_constraint(:form_responses, "jsonb_typeof(answers) = 'object' AND octet_length(answers::text) <= 65536", name: "form_responses_answers_object_max_64kb")

    create_table(:form_daily_stats) do |t|
      t.references(:form, null: false, foreign_key: { on_delete: :cascade }, index: false)
      t.date(:day, null: false)
      t.integer(:views, null: false, default: 0)
      t.integer(:unique_views, null: false, default: 0)
      t.integer(:starts, null: false, default: 0)
    end
    add_index(:form_daily_stats, [:form_id, :day], unique: true)
  end
end
