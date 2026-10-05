class PublicFormSerializer < BaseSerializer
  root_key :form

  FIELD_KEYS = ["id", "type", "label", "help", "required", "choices", "max_choices", "scale", "min", "max"].freeze
  CHOICE_KEYS = ["id", "label"].freeze

  attributes :title, :description, :thank_you_message, :theme, :layout

  attribute :fields do |form|
    form.fields.map do |field|
      field.slice(*FIELD_KEYS).tap do |visible|
        visible["choices"] = visible["choices"].map { |choice| choice.slice(*CHOICE_KEYS) } if visible["choices"]
      end
    end
  end
end
