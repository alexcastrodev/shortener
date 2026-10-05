class Api::Me::FormAppointmentsController < ApplicationController
  include FormLookup

  before_action :authenticate_user!, prepend: true
  include AppointmentsGate
  before_action :parse_dates

  PAGE = 50
  XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".freeze

  def index
    scope = search.order(id: :desc)
    scope = scope.where(id: ...params[:before].to_i) if params[:before].present?
    rows = scope.limit(PAGE + 1).to_a
    more = rows.size > PAGE
    rows = rows.first(PAGE)
    render(json: { appointments: rows.map { |row| Appointments::Search.row(row) }, next_before: more ? rows.last.id : nil }, status: :ok)
  end

  def export
    scope = search.order(Arel.sql("appointment_slots.starts_at"), :id)
    return render(json: { error: "export_too_large" }, status: :payload_too_large) if scope.limit(Appointments::Search::MAX_EXPORT + 1).count > Appointments::Search::MAX_EXPORT

    rows = scope.map { |row| Appointments::Search.row(row) }
    response.headers["Cache-Control"] = "private, no-store"
    name = "#{@form.title.parameterize.presence || "form"}-appointments"
    if params[:format_type] == "xlsx"
      send_data(xlsx(rows), type: XLSX_TYPE, disposition: "attachment", filename: "#{name}.xlsx")
    else
      send_data(Appointments::Search.csv(rows), type: "text/csv; charset=utf-8", disposition: "attachment", filename: "#{name}.csv")
    end
  end

  private

  def search
    Appointments::Search.call(form: @form, status: params[:status], query: params[:q], from: @from, to: @to, zone: Time.find_zone!(current_user.time_zone))
  end

  def parse_dates
    @from = params[:from].present? ? Date.iso8601(params[:from].to_s) : nil
    @to = params[:to].present? ? Date.iso8601(params[:to].to_s) : nil
  rescue Date::Error
    render(json: { error: "invalid_range" }, status: :unprocessable_entity)
  end

  def xlsx(rows)
    package = Axlsx::Package.new
    package.workbook.add_worksheet(name: "Appointments") do |sheet|
      header = ["Starts at", "Service", "Name", "Email", "Status", "Booked at", "Reason"]
      sheet.add_row(header, types: Array.new(header.size, :string))
      rows.each do |item|
        cells = [item[:starts_at], item[:service_name], item[:client_name], item[:client_email], item[:status], item[:created_at], item[:cancel_reason]].map(&:to_s)
        sheet.add_row(cells, types: Array.new(cells.size, :string))
      end
    end
    package.to_stream.read
  end
end
