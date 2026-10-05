require "aws-sdk-s3"

class Api::Public::FormUploadsController < ApplicationController
  include ClientIp
  include PublicJsonEndpoint

  MAX_SIZE = 10.megabytes
  FIELD_ID = /\A[A-Za-z0-9]{#{Forms::FieldSchema::ID_LENGTH}}\z/
  STORAGE_ERRORS = [Aws::Errors::ServiceError, Seahorse::Client::NetworkingError, SystemCallError, Timeout::Error, IOError].freeze

  skip_before_action :require_json
  prepend_before_action :require_multipart

  rate_limit to: 15,
    within: 10.minutes,
    name: "public_form_upload",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  before_action :load_form
  before_action :load_field

  def create
    file = params[:file]
    problem = ImageUpload.basic_error(file, max_size: MAX_SIZE)
    return render(json: { error: "invalid_image", message: problem }, status: :unprocessable_entity) if problem

    return unavailable if FormUpload.over_budget?

    webp = Imgproc.convert(File.binread(file.tempfile.path))
    upload = @form.uploads.create!(field_id: @field["id"])
    attach(upload, webp)
    render(json: { token: upload.token }, status: :created)
  rescue Imgproc::Rejected
    render(json: { error: "invalid_image", message: "could not be read as an image" }, status: :unprocessable_entity)
  rescue Imgproc::Unavailable
    unavailable
  end

  private

  def body_limit
    MAX_SIZE + 1.megabyte
  end

  def require_multipart
    head(415) unless request.media_type == "multipart/form-data"
  end

  def attach(upload, webp)
    upload.file.attach(io: StringIO.new(webp), filename: "image.webp", content_type: "image/webp")
  rescue *STORAGE_ERRORS
    upload.destroy
    raise Imgproc::Unavailable
  end

  def unavailable
    render(json: { error: "uploads_unavailable" }, status: :service_unavailable)
  end

  def load_form
    raise ActiveRecord::RecordNotFound unless params[:public_id].to_s.match?(Api::Public::FormResponsesController::PUBLIC_ID)

    @form = Form.visible.find_by!(public_id: params[:public_id])
  end

  def load_field
    raise ActiveRecord::RecordNotFound unless params[:field_id].to_s.match?(FIELD_ID)

    @field = @form.fields.find { |field| field["id"] == params[:field_id] && field["type"] == "image" }
    raise ActiveRecord::RecordNotFound unless @field
  end
end
