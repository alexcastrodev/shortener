class Api::Public::FormSlotsController < ApplicationController
  include ClientIp

  rate_limit to: 120,
    within: 1.minute,
    only: :index,
    name: "public_form_slots",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  def index
    raise ActiveRecord::RecordNotFound unless params[:public_id].to_s.match?(Api::Public::FormsController::PUBLIC_ID)

    form = Form.visible.find_by!(public_id: params[:public_id])

    booking = Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" }
    service = booking&.fetch("services", [])&.find { |item| item["id"] == params[:service].to_s }
    raise ActiveRecord::RecordNotFound unless service

    from, to = range
    return render(json: { error: "invalid_range" }, status: :unprocessable_content) unless from && to && to >= from && (to - from) < Appointments::Slots::MAX_RANGE_DAYS

    body = { time_zone: booking["rules"]["time_zone"], slots: slots_for(form, booking, service, from, to) }
    body[:full] = full_for(booking, service, from..to, body[:slots]) if Appointments::Waitlist.enabled?(booking) && service["capacity"]
    render(json: body, status: :ok)
  end

  private

  def range
    [Date.iso8601(params[:from].to_s), Date.iso8601(params[:to].to_s)]
  rescue Date::Error
    nil
  end

  def full_for(booking, service, days, free)
    open = free.to_h { |slot| [slot[:starts_at], true] }
    offered = Appointments::Slots.call(service: service, rules: booking["rules"], from: days.first, to: days.last, exceptions: booking["exceptions"].to_a)
    offered.reject { |slot| open[slot[:starts_at].iso8601] }.map { |slot| { starts_at: slot[:starts_at].iso8601, date: slot[:date].iso8601, time: slot[:time] } }
  end

  def slots_for(form, booking, service, from, to)
    Appointments::FreeSlots.call(form: form, booking: booking, service: service, from: from, to: to).map do |slot|
      { starts_at: slot[:starts_at].iso8601, date: slot[:date].iso8601, time: slot[:time], remaining: slot[:remaining] }
    end
  end
end
