class Api::Me::FormUploadsController < ApplicationController
  include FormLookup

  before_action :authenticate_user!, prepend: true

  def show
    upload = @form.uploads.where.not(response_id: nil).find_by!(token: params[:id].to_s)
    response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
    response.headers["Cache-Control"] = "private, no-store"
    send_data(upload.file.download, type: "image/webp", disposition: "attachment", filename: "image.webp")
  end
end
