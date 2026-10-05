module FormBlobGuard
  extend ActiveSupport::Concern

  included do
    before_action :refuse_form_blobs
  end

  private

  def refuse_form_blobs
    head(:not_found) if @blob&.attachments&.where(record_type: "FormUpload")&.exists?
  end
end
