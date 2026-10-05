module Mcp
  module Tools
    module FormToolHelpers
      FIELD_PROPERTIES = {
        type: { type: "string", enum: Forms::FieldSchema::TYPES },
        label: { type: "string", maxLength: Forms::FieldSchema::LABEL_MAX },
        help: { type: "string", maxLength: Forms::FieldSchema::HELP_MAX },
        required: { type: "boolean" },
        choices: {
          type: "array",
          maxItems: 50,
          items: { type: "object", properties: { id: { type: "string", maxLength: 8 }, label: { type: "string", maxLength: Forms::FieldSchema::CHOICE_LABEL_MAX } }, required: ["label"], additionalProperties: false },
        },
        max_choices: { type: "integer", minimum: 1, maximum: 50 },
        scale: { type: "integer", enum: Forms::FieldSchema::RATING_SCALES },
        min: { type: "number" },
        max: { type: "number" },
      }.freeze

      def self.form_json(form, detail: true)
        json = {
          id: form.id,
          title: Mcp::Content.clean(form.title, max: 120),
          published: form.published,
          responses_count: form.responses_count,
          questions: form.fields.size,
          dashboard_url: "#{ENV.fetch("FRONTEND_URL", "https://kurz.fyi")}/app/forms/#{form.id}",
        }
        return json unless detail

        json.merge(
          description: form.description && Mcp::Content.clean(form.description, max: 1000),
          thank_you_message: form.thank_you_message && Mcp::Content.clean(form.thank_you_message, max: 500),
          theme: form.theme,
          fields: form.fields.map { |field| field_json(field) },
        )
      end

      def self.field_json(field)
        json = field.slice("id", "type", "required", "max_choices", "scale", "min", "max")
        json["label"] = Mcp::Content.clean(field["label"], max: Forms::FieldSchema::LABEL_MAX)
        json["help"] = Mcp::Content.clean(field["help"], max: Forms::FieldSchema::HELP_MAX) if field["help"]
        json["choices"] = field["choices"].map { |choice| { "id" => choice["id"], "label" => Mcp::Content.clean(choice["label"], max: Forms::FieldSchema::CHOICE_LABEL_MAX) } } if field["choices"]
        json
      end

      def self.draft_note(json)
        json.merge(note: "Draft: it is not public. Publish it from the dashboard.")
      end

      def self.field_attributes(arguments)
        arguments.compact.transform_keys(&:to_s)
      end
    end
  end
end
