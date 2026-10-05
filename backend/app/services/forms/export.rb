module Forms
  class Export
    include Callable

    MAX_ROWS = 50_000
    SHEET_FORBIDDEN = %r{[\[\]:*?/\\]}

    class TooLarge < StandardError; end

    def initialize(form:, days: nil)
      @form = form
      @days = Summary::PERIODS.include?(days.to_i) ? days.to_i : nil
    end

    def call
      scope = form.responses.order(:id)
      scope = scope.where(created_at: (days - 1).days.ago.utc.beginning_of_day..) if days
      raise TooLarge if scope.limit(MAX_ROWS + 1).count > MAX_ROWS

      package = Axlsx::Package.new
      package.workbook.add_worksheet(name: sheet_name) do |sheet|
        sheet.add_row(header, types: Array.new(header.size, :string))
        scope.find_each { |row| add(sheet, row) }
      end
      package.to_stream.read
    end

    private

    attr_reader :form, :days

    def questions
      @questions ||= Snapshot.reporting_fields(form).select { |field| FieldSchema.answerable?(field) }
    end

    def header
      @header ||= ["Submitted", *questions.map { |field| field["label"].to_s }, "Source", "Platform", "Browser", "Country"]
    end

    def sheet_name
      form.title.to_s.gsub(SHEET_FORBIDDEN, " ").strip.first(31).presence || "Responses"
    end

    def add(sheet, row)
      cells = [row.created_at.utc.iso8601, *questions.map { |field| value(field, row.answers[field["id"]]) }, row.source, row.platform, row.browser, row.country]
      sheet.add_row(cells, types: cells.map { |cell| cell.is_a?(Numeric) ? nil : :string })
    end

    def value(field, raw)
      return if raw.nil?

      case field["type"]
      when "single_choice" then label(field, raw)
      when "multiple_choice" then Array(raw).map { |id| label(field, id) }.join(", ")
      when "yes_no" then raw ? "Yes" : "No"
      when "image" then "Image"
      when "number", "rating" then raw.is_a?(Numeric) ? raw : raw.to_s
      else raw.to_s
      end
    end

    def label(field, id)
      field["choices"].to_a.find { |choice| choice["id"] == id }&.fetch("label") || "(removed option)"
    end
  end
end
