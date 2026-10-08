class AddAcceptingResponsesToForms < ActiveRecord::Migration[8.1]
  def change
    add_column(:forms, :accepting_responses, :boolean, default: true, null: false)
  end
end
