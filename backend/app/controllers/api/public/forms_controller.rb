class Api::Public::FormsController < ApplicationController
  include ClientIp

  rate_limit to: 120,
    within: 1.minute,
    only: :show,
    name: "public_forms_show",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  PUBLIC_ID = /\A[A-Za-z0-9]{#{Form::PUBLIC_ID_LENGTH}}\z/

  def show
    raise ActiveRecord::RecordNotFound unless params[:public_id].to_s.match?(PUBLIC_ID)

    form = Form.visible.find_by!(public_id: params[:public_id])
    render(json: PublicFormSerializer.new(form).serialize, status: :ok)
  end
end
