class Api::Public::WaitlistEntriesController < ApplicationController
  include ClientIp

  rate_limit to: 60,
    within: 1.minute,
    only: :show,
    name: "public_waitlist_show",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  rate_limit to: 20,
    within: 1.minute,
    only: [:claim, :leave],
    name: "public_waitlist_act",
    by: -> { client_ip },
    with: -> { render(json: { error: "rate_limited" }, status: :too_many_requests) }

  before_action :load_entry

  def show
    render(json: payload, status: :ok)
  end

  def claim
    result = Appointments::Waitlist.claim(@entry)
    render(json: payload.merge(result: result), status: :ok)
  end

  def leave
    result = Appointments::Waitlist.leave(@entry)
    render(json: payload.merge(result: result), status: :ok)
  end

  private

  def load_entry
    @entry = WaitlistEntry.from_token(params[:token])
    render(json: { error: "not_found" }, status: :not_found) unless @entry
    @entry&.reload
  end

  def payload
    entry = @entry.reload
    booking = Appointments::Waitlist.booking_of(entry.form)
    service = booking&.fetch("services", [])&.find { |item| item["id"] == entry.service_key }
    {
      waitlist: {
        form_title: entry.form.title,
        service: service&.fetch("name", nil),
        starts_at: entry.starts_at.iso8601,
        status: entry.status,
        offered_until: entry.offered_until&.iso8601,
        time_zone: Appointments::Book.valid_zone(entry.time_zone) || "UTC",
      },
    }
  end
end
