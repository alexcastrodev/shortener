class Form < ApplicationRecord
  MAX_CREATED_PER_DAY = 20
  audited only: [:title, :published]
  PUBLIC_ID_LENGTH = 12
  before_validation(on: :create) { self.public_id ||= SecureRandom.alphanumeric(PUBLIC_ID_LENGTH) }

  belongs_to :user
  scope :visible, -> { where(published: true).joins(:user).merge(User.active) }

  validates :title, presence: true, length: { maximum: 120 }
  validates :description, length: { maximum: 1000 }
  validates :thank_you_message, length: { maximum: 500 }
  validates :theme, inclusion: { in: Page::THEMES }
  validate :field_definitions

  def public_url
    "#{ENV["FRONTEND_URL"]}/f/#{public_id}"
  end

  private

  def field_definitions
    Forms::FieldSchema.definition_errors(fields).each { |message| errors.add(:fields, message) }
  end
end
