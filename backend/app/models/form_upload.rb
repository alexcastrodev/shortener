class FormUpload < ApplicationRecord
  ORPHAN_AFTER = 1.hour
  TOKEN_FORMAT = /\A[A-Za-z0-9]{24}\z/

  belongs_to :form
  belongs_to :response, class_name: "FormResponse", optional: true
  has_one_attached :file, **(Rails.env.production? && ENV["S3_FORMS_BUCKET"].present? ? { service: :seaweedfs_forms } : {})
  has_secure_token :token, length: 24

  before_create { self.created_at ||= Time.current }

  scope :orphaned, -> { where(response_id: nil, created_at: ...ORPHAN_AFTER.ago) }
end
