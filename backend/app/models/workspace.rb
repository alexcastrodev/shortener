class Workspace < ApplicationRecord
  MODES = ["services"].freeze
  MAX_PER_USER = 10
  DEFAULT_NAME = "Main".freeze

  belongs_to :user
  has_many :forms, dependent: :restrict_with_exception

  attr_readonly :mode

  validates :name, presence: true, length: { maximum: 80 }
  validates :mode, inclusion: { in: MODES }
  validate :under_limit, on: :create

  def self.default_for(user)
    user.workspaces.order(:id).first || user.workspaces.create!(name: DEFAULT_NAME)
  end

  private

  def under_limit
    errors.add(:base, "an account can have at most #{MAX_PER_USER} workspaces") if user && user.workspaces.count >= MAX_PER_USER
  end
end
