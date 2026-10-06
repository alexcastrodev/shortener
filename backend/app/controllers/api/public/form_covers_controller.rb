class Api::Public::FormCoversController < ApplicationController
  include ClientIp

  TOKEN = FormUpload::TOKEN_FORMAT

  rate_limit to: 240,
    within: 1.minute,
    name: "public_form_cover",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  def show
    raise ActiveRecord::RecordNotFound unless params[:public_id].to_s.match?(Api::Public::FormsController::PUBLIC_ID) && params[:token].to_s.match?(TOKEN)

    form = Form.visible.find_by!(public_id: params[:public_id])
    raise ActiveRecord::RecordNotFound unless Forms::PublicDefinition.for(form).cover_token == params[:token]

    cover = form.uploads.find_by!(token: params[:token], field_id: Form::COVER_FIELD)
    response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
    response.headers["Cache-Control"] = "public, max-age=3600"
    send_data(cover.file.download, type: "image/webp", disposition: "inline", filename: "cover.webp")
  end
end
