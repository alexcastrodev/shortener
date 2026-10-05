class FormResponse < ApplicationRecord
  ANSWERS_MAX_BYTES = 32.kilobytes

  belongs_to :form
  counter_culture :form, column_name: "responses_count"
  has_many :uploads, class_name: "FormUpload", foreign_key: :response_id, dependent: :destroy, inverse_of: :response

  validates :country, format: { with: /\A[A-Z]{2}\z/ }, allow_nil: true
  validate :answers_is_object
  validate :answers_size

  private

  def answers_size
    errors.add(:answers, :too_long, count: ANSWERS_MAX_BYTES) if answers.is_a?(Hash) && answers.to_json.bytesize > ANSWERS_MAX_BYTES
  end

  def answers_is_object
    errors.add(:answers, :invalid) unless answers.is_a?(Hash)
  end
end
