require "aws-sdk-s3"

class Api::Me::FormCoversController < ApplicationController
  include FormLookup

  STORAGE_ERRORS = [Aws::Errors::ServiceError, Seahorse::Client::NetworkingError, SystemCallError, Timeout::Error, IOError].freeze

  before_action :authenticate_user!, prepend: true
  before_action :require_multipart, only: :update

  rate_limit to: 20,
    within: 10.minutes,
    only: :update,
    name: "form_cover_upload",
    by: -> { @current_user&.id || request.remote_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  def show
    cover = @form.cover
    raise ActiveRecord::RecordNotFound unless cover

    response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
    response.headers["Cache-Control"] = "private, no-store"
    send_data(cover.file.download, type: "image/webp", disposition: "inline", filename: "cover.webp")
  end

  def update
    file = params[:file]
    problem = CoverUpload.error_for(file)
    return render(json: { error: "invalid_image", message: problem }, status: :unprocessable_entity) if problem
    return render(json: { error: "uploads_unavailable" }, status: :service_unavailable) if FormUpload.over_budget?

    webp = Imgproc.convert(File.binread(file.tempfile.path))
    cover = @form.uploads.create!(field_id: Form::COVER_FIELD)
    attach(cover, webp)
    @form.update!(cover_token: cover.token)
    Forms::Covers.prune(@form)
    render(json: FormSerializer.new(@form.reload).serialize, status: :ok)
  rescue Imgproc::Rejected
    render(json: { error: "invalid_image", message: "could not be read as an image" }, status: :unprocessable_entity)
  rescue Imgproc::Unavailable
    render(json: { error: "uploads_unavailable" }, status: :service_unavailable)
  end

  def destroy
    @form.update!(cover_token: nil)
    Forms::Covers.prune(@form)
    render(json: FormSerializer.new(@form.reload).serialize, status: :ok)
  end

  private

  def require_multipart
    head(415) unless request.media_type == "multipart/form-data"
  end

  def attach(cover, webp)
    cover.file.attach(io: StringIO.new(webp), filename: "cover.webp", content_type: "image/webp")
  rescue *STORAGE_ERRORS
    cover.destroy
    raise Imgproc::Unavailable
  end
end
