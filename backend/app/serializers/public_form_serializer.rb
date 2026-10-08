class PublicFormSerializer < BaseSerializer
  root_key :form

  FIELD_KEYS = ["id", "type", "label", "help", "required", "choices", "max_choices", "scale", "min", "max"].freeze
  CHOICE_KEYS = ["id", "label"].freeze

  attributes :title, :description, :thank_you_message, :theme, :custom_colors, :layout, :cover_token, :cover_position, :intro_enabled, :start_label

  attributes :published_version

  attribute :fields do |form|
    form.fields.map do |field|
      field.slice(*FIELD_KEYS).tap do |visible|
        visible["choices"] = visible["choices"].map { |choice| choice.slice(*CHOICE_KEYS) } if visible["choices"]
        if field["type"] == "booking"
          visible["services"] = field["services"].map { |service| service.slice(*Forms::BookingSchema::PUBLIC_SERVICE_KEYS) }
          visible["categories"] = field["categories"].to_a
          visible["waitlist"] = field.dig("rules", "waitlist") == true
          visible["verify_email"] = field.dig("rules", "verify_email") == true
          visible["time_zone"] = field.dig("rules", "time_zone")
        end
      end
    end
  end
end
