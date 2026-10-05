module Forms
  module Snapshot
    extend self

    KEYS = ["title", "description", "thank_you_message", "theme", "custom_colors", "layout", "fields"].freeze

    def enabled?
      ENV["FORM_DRAFTS_ENABLED"] == "true"
    end

    def reporting_fields(form)
      return form.fields unless enabled? && form.published_snapshot.present?

      known = form.fields.pluck("id")
      form.fields + form.published_snapshot["fields"].reject { |field| known.include?(field["id"]) }
    end

    def of(form)
      JSON.parse(form.slice(*KEYS).to_json)
    end

    def changed?(form)
      form.published_snapshot.present? && form.published_snapshot != of(form)
    end
  end
end
