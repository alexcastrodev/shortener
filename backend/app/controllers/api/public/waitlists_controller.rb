class Api::Public::WaitlistsController < ApplicationController
  include ClientIp
  include PublicJsonEndpoint

  rate_limit to: 10,
    within: 10.minutes,
    name: "public_waitlist_join",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  before_action :load_form
  before_action :swallow_honeypot
  before_action :verify_turnstile

  def create
    body = request.request_parameters
    joined = Appointments::Waitlist.join(form: @form, service_id: body["service"].to_s, date: body["date"], time: body["time"], name: body["name"], email: body["email"], locale: body["client_locale"], zone: body["client_time_zone"])
    case joined.status
    when :ok then render(json: { ok: true, status: joined.entry.status }, status: :created)
    when :not_full then render(json: { error: "not_full" }, status: :conflict)
    when :list_full then render(json: { error: "waitlist_full" }, status: :conflict)
    when :too_many then render(json: { error: "too_many_waitlists" }, status: :too_many_requests)
    when :invalid then render(json: { error: "invalid" }, status: :unprocessable_entity)
    else render(json: { error: "unavailable" }, status: :unprocessable_entity)
    end
  end

  private

  def load_form
    raise ActiveRecord::RecordNotFound unless params[:public_id].to_s.match?(Api::Public::FormsController::PUBLIC_ID)

    @form = Form.visible.find_by!(public_id: params[:public_id])
    raise ActiveRecord::RecordNotFound unless Appointments::Config.enabled_for?(@form.user)
  end

  def swallow_honeypot
    render(json: { ok: true }, status: :created) if request.request_parameters["website"].present?
  end

  def verify_turnstile
    result = Turnstile.check(request.request_parameters["turnstile_token"], action: "form_response", remote_ip: client_ip)
    render(json: { error: "captcha_failed" }, status: :forbidden) if result == :rejected
  end
end
