class AddFormIdsToAbuseSignals < ActiveRecord::Migration[8.1]
  def change
    add_column(:abuse_signals, :form_ids, :jsonb, default: [], null: false)
  end
end
