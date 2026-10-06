class Api::Public::FormResponsesController < ApplicationController
  include ClientIp
  include PublicJsonEndpoint

  PUBLIC_ID = /\A[A-Za-z0-9]{#{Form::PUBLIC_ID_LENGTH}}\z/

  rate_limit to: 30,
    within: 10.minutes,
    name: "public_form_submit",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  before_action :load_form
  before_action :swallow_honeypot
  before_action :verify_turnstile

  rate_limit to: 5,
    within: 10.minutes,
    name: "public_form_submit_degraded",
    by: -> { client_ip },
    if: -> { @turnstile == :unavailable },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  def create
    result = Forms::SubmitResponse.call(
      form: @form,
      answers: request.request_parameters["answers"],
      idempotency_key: request.request_parameters["idempotency_key"],
      meta: meta,
      version: request.request_parameters["form_version"],
      client: { time_zone: request.request_parameters["client_time_zone"], locale: request.request_parameters["client_locale"] },
    )

    if result.errors
      render(json: { errors: { answers: result.errors.fetch("answers", result.errors) } }, status: :unprocessable_content)
    else
      body = { ok: true }
      appointments = Appointments::Book.summary(result.response)
      if appointments.any?
        body[:appointments] = appointments
        body.merge!(Appointments::Book.receipt(result.response))
      end
      render(json: body, status: result.created ? :created : :ok)
    end
  end

  rescue_from Forms::SubmitResponse::FormChanged do |error|
    render(json: { error: "form_changed", form: JSON.parse(PublicFormSerializer.new(error.definition).serialize)["form"] }, status: :conflict)
  end

  rescue_from Appointments::Book::Full do |error|
    render(json: { error: "slot_full", starts_at: error.starts_at.iso8601 }, status: :conflict)
  end

  private

  def load_form
    raise ActiveRecord::RecordNotFound unless params[:public_id].to_s.match?(PUBLIC_ID)

    @form = Form.visible.find_by!(public_id: params[:public_id])
  end

  def swallow_honeypot
    render(json: { ok: true }, status: :created) if request.request_parameters["website"].present?
  end

  def verify_turnstile
    @turnstile = Turnstile.check(request.request_parameters["turnstile_token"], action: "form_response", remote_ip: client_ip)
    render(json: { error: "captcha_failed" }, status: :forbidden) if @turnstile == :rejected
  end

  def meta
    user_agent = request.user_agent.to_s
    {
      country: country_code,
      platform: UserAgentParser.platform(user_agent),
      browser: UserAgentParser.browser(user_agent),
      source: TrafficSource.call(user_agent: user_agent, referer: request.request_parameters["referer"].to_s.first(255)),
    }
  end

  def country_code
    country = request.headers["CF-IPCountry"].to_s.strip.upcase
    country unless ["XX", "T1"].include?(country)
  end
end
