class FormResponseSerializer < BaseSerializer
  root_key :response
  root_key_for_collection :response

  attributes :id, :country, :platform, :browser, :source

  attribute :submitted_at do |response|
    response.created_at.iso8601
  end

  attribute :answers do |response|
    fields = params[:fields] || []
    known = fields.filter_map do |field|
      next unless response.answers.key?(field["id"])

      value = response.answers[field["id"]]
      value = Array(value).map { |id| field["choices"].find { |c| c["id"] == id }&.fetch("label") || nil }.compact if field["choices"] && value.is_a?(Array)
      value = field["choices"].find { |c| c["id"] == value }&.fetch("label") if field["choices"] && !value.is_a?(Array)
      { id: field["id"], label: field["label"], type: field["type"], value: value }
    end
    known
  end
end
