class FormUpload < ApplicationRecord
  ORPHAN_AFTER = 1.hour
  TOKEN_FORMAT = /\A[A-Za-z0-9]{24}\z/
  MAX_TOTAL_BYTES = 20.gigabytes

  belongs_to :form
  belongs_to :response, class_name: "FormResponse", optional: true
  has_one_attached :file, **(Rails.env.production? && ENV["S3_FORMS_BUCKET"].present? ? { service: :seaweedfs_forms } : {})
  has_secure_token :token, length: 24

  before_create { self.created_at ||= Time.current }

  def self.over_budget?
    Rails.cache.fetch("form_uploads/total_bytes", expires_in: 1.minute) do
      ActiveStorage::Blob.joins(:attachments).where(active_storage_attachments: { record_type: name }).sum(:byte_size)
    end >= MAX_TOTAL_BYTES
  end

  scope :orphaned, -> { where(response_id: nil, created_at: ...ORPHAN_AFTER.ago).where.not(field_id: Form::COVER_FIELD) }
end
