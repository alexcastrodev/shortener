class Form < ApplicationRecord
  # Per user, counted over the last 24 hours (Forms::Create). The only product quota; the rest are
  # technical limits and rate limits.
  MAX_CREATED_PER_DAY = 20

  # Respondents' answers are personal data: only the title and the published flag are audited,
  # because /api/admin/audits exposes audited_changes to every admin.
  audited only: [:title, :published]

  # Random, never sequential, no chosen slug. 62^12 combinations; the unique index backs it up
  # (has_secure_token refuses tokens shorter than 24 characters).
  PUBLIC_ID_LENGTH = 12
  before_validation(on: :create) { self.public_id ||= SecureRandom.alphanumeric(PUBLIC_ID_LENGTH) }

  belongs_to :user

  # Same rule as Page.visible: published and owned by an active account.
  scope :visible, -> { where(published: true).joins(:user).merge(User.active) }

  validates :title, presence: true, length: { maximum: 120 }
  validates :description, length: { maximum: 1000 }
  validates :thank_you_message, length: { maximum: 500 }
  validates :theme, inclusion: { in: Page::THEMES }
  validate :fields_is_array

  private

  def fields_is_array
    errors.add(:fields, :invalid) unless fields.is_a?(Array)
  end
end
