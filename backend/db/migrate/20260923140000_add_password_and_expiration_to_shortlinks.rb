class AddPasswordAndExpirationToShortlinks < ActiveRecord::Migration[8.0]
  def change
    add_column(:shortlinks, :password_digest, :string)
    add_column(:shortlinks, :expires_at, :datetime)
    add_index(:shortlinks, :expires_at, where: "expires_at IS NOT NULL AND inactive_at IS NULL")
  end
end
