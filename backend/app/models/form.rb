class Form < ApplicationRecord
  include CustomColors

  MAX_CREATED_PER_DAY = 20
  TITLE_MAX = 120
  LAYOUTS = ["page", "one_at_a_time", "steps"].freeze
  audited only: [:title, :published]
  PUBLIC_ID_LENGTH = 12
  before_validation(on: :create) { self.public_id ||= SecureRandom.alphanumeric(PUBLIC_ID_LENGTH) }

  belongs_to :user
  belongs_to :shortlink, optional: true
  before_destroy { shortlink&.soft_delete! }
  has_many :uploads, class_name: "FormUpload", dependent: :destroy
  has_many :responses, class_name: "FormResponse", dependent: :delete_all
  has_many :appointments, dependent: nil
  has_many :daily_stats, class_name: "FormDailyStat", dependent: :delete_all
  scope :visible, -> { where(published: true).joins(:user).merge(User.active) }

  validates :title, presence: true, length: { maximum: TITLE_MAX }
  validates :description, length: { maximum: 1000 }
  validates :thank_you_message, length: { maximum: 500 }
  validates :theme, inclusion: { in: Page::THEMES }
  validates :layout, inclusion: { in: LAYOUTS }
  validate :field_definitions

  def public_url
    "#{ENV["FRONTEND_URL"]}/f/#{public_id}"
  end

  def ensure_shortlink!
    return shortlink if shortlink
    return if ENV["FRONTEND_URL"].blank?

    link = user.shortlinks.create!(original_url: public_url, title: title.first(120))
    update_column(:shortlink_id, link.id)
    link
  end

  private

  def field_definitions
    Forms::FieldSchema.definition_errors(fields).each { |message| errors.add(:fields, message) }
    errors.add(:fields, "booking is not available for this account") if booking_without_access?
  end

  def booking_without_access?
    fields_changed? && user && !Appointments::Config.enabled_for?(user) && Forms::BookingSchema.added?(fields, fields_was)
  end
end
