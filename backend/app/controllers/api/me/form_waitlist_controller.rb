class Api::Me::FormWaitlistController < ApplicationController
  include FormLookup

  before_action :authenticate_user!, prepend: true
  include AppointmentsGate

  def index
    rows = @form.waitlist_entries.active.order(:starts_at, :id).limit(200)
    render(json: { waitlist: rows.map { |row| { id: row.id, service_id: row.service_key, starts_at: row.starts_at.iso8601, name: row.name, email: row.email, status: row.status, offered_until: row.offered_until&.iso8601 } } }, status: :ok)
  end
end
