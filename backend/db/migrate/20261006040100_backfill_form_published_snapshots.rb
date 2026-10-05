class BackfillFormPublishedSnapshots < ActiveRecord::Migration[8.1]
  def up
    Forms::BackfillSnapshots.call
  end

  def down
  end
end
