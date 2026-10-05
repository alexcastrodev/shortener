class ColorPalette < ApplicationRecord
  include CustomColors

  MAX_PER_USER = 20

  belongs_to :user

  validates :name, presence: true, length: { maximum: 40 }
  validates :custom_colors, presence: true
  validate :per_user_limit, on: :create

  private

  def per_user_limit
    errors.add(:base, "You can save up to #{MAX_PER_USER} palettes") if user && user.color_palettes.count >= MAX_PER_USER
  end
end
