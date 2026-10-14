class ValidateShortlinksUserForeignKey < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :shortlinks, :users
  end
end
