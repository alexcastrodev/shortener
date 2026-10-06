class Api::Public::FormEventsController < ApplicationController
  include ClientIp
  include PublicJsonEndpoint

  BODY_LIMIT = 1.kilobyte
  PUBLIC_ID = /\A[A-Za-z0-9]{#{Form::PUBLIC_ID_LENGTH}}\z/

  rate_limit to: 60,
    within: 1.minute,
    name: "public_form_events",
    by: -> { client_ip },
    with: -> { head(:too_many_requests) }

  def create
    raise ActiveRecord::RecordNotFound unless params[:public_id].to_s.match?(PUBLIC_ID)

    form = Form.visible.find_by!(public_id: params[:public_id])
    tracked = Forms::TrackEvent.call(
      form: form,
      event: request.request_parameters["event"],
      ip: client_ip,
      user_agent: request.user_agent,
    )

    tracked ? head(:no_content) : render(json: { error: "invalid_event" }, status: :unprocessable_content)
  end

  private

  def body_limit
    BODY_LIMIT
  end
end
