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
    raise ActiveRecord::RecordNotFound unless Appointments::Config.enabled_for?(form.user)

    booking = Forms::PublicDefinition.for(form).fields.find { |field| field["type"] == "booking" }
    service = booking&.fetch("services", [])&.find { |item| item["id"] == params[:service].to_s }
    raise ActiveRecord::RecordNotFound unless service

    from, to = range
    return render(json: { error: "invalid_range" }, status: :unprocessable_entity) unless from && to && to >= from && (to - from) < Appointments::Slots::MAX_RANGE_DAYS

    render(json: { time_zone: booking["rules"]["time_zone"], slots: slots_for(form, booking, service, from, to) }, status: :ok)
  end

  private

  def range
    [Date.iso8601(params[:from].to_s), Date.iso8601(params[:to].to_s)]
  rescue Date::Error
    nil
  end

  def slots_for(form, booking, service, from, to)
    rules = booking["rules"]
    zone = Time.find_zone!(rules["time_zone"])
    stored = AppointmentSlot.where(form_id: form.id, starts_at: zone.local(from.year, from.month, from.day).utc..zone.local(to.year, to.month, to.day).end_of_day.utc)
    booked = stored.where(service_key: service["id"]).pluck(:starts_at, :booked).to_h { |time, count| [time.to_i, count] }
    totals = stored.pluck(:starts_at, :booked).each_with_object(Hash.new(0)) { |(time, count), sums| sums[time.in_time_zone(zone).to_date] += count }

    Appointments::Slots.call(service: service, rules: rules, from: from, to: to, booked: booked, day_totals: totals).map do |slot|
      { starts_at: slot[:starts_at].iso8601, date: slot[:date].iso8601, time: slot[:time], remaining: slot[:remaining] }
    end
  end
end
